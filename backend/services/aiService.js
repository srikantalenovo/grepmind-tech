import { localModelClient } from '../utils/localModelClient.js';
import { chatBotService } from './chatBot.js';
import { llmService } from './llmService.js';
import { healthCheckService } from '../config/health.check.js';
import { AI_CONFIG } from '../config/aiConfig.js';

/**
 * Production AI Service
 * Central orchestrator for all AI operations in production mode
 * Only works with real model inference - no fallback responses
 */
class AIService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.services = {
      chat: chatBotService,
      llm: llmService
    };
    this.startTime = Date.now();
    this.totalRequests = 0;
    this.errors = [];
  }

  /**
   * Initialize all production AI services
   */
  async initialize() {
    if (this.initialized) {
      return { success: true, message: 'Production AI services already initialized' };
    }

    if (this.initializationPromise) {
      return await this.initializationPromise;
    }

    this.initializationPromise = this._performProductionInitialization();
    return await this.initializationPromise;
  }

  /**
   * Perform production initialization with strict requirements
   */
  async _performProductionInitialization() {
    try {
      console.log('🚀 Initializing Production AI Services...');

      // Step 1: Initialize local model client (strict requirement)
      console.log('📦 Initializing production model client...');
      const modelResult = await localModelClient.initialize();
      
      if (!modelResult.success) {
        throw new Error(`Production model initialization failed: ${modelResult.error}`);
      }

      if (!modelResult.nativeSupport) {
        throw new Error('Production mode requires native model support. Please ensure node-llama-cpp is properly installed.');
      }

      console.log('✅ Production model client initialized successfully');

      // Step 2: Initialize individual services with strict requirements
      console.log('🔧 Initializing production AI services...');
      
      const initResults = await Promise.allSettled([
        this.services.chat.initialize(),
        this.services.llm.initialize()
      ]);

      const serviceStatus = {};
      const failedServices = [];
      
      initResults.forEach((result, index) => {
        const serviceName = index === 0 ? 'chat' : 'llm';
        if (result.status === 'fulfilled') {
          serviceStatus[serviceName] = {
            success: true,
            productionMode: true
          };
          console.log(`✅ ${serviceName} service initialized`);
        } else {
          serviceStatus[serviceName] = {
            success: false,
            error: result.reason.message
          };
          failedServices.push(serviceName);
          console.error(`❌ ${serviceName} service failed:`, result.reason.message);
        }
      });

      // Production requirement: at least one service must work
      if (failedServices.length === 2) {
        throw new Error('All AI services failed to initialize. Production mode requires at least one working service.');
      }

      if (failedServices.length > 0) {
        console.warn(`⚠️  Some services failed: ${failedServices.join(', ')}`);
      }

      this.initialized = true;
      console.log('🎉 Production AI Services initialization completed!');

      return {
        success: true,
        message: 'Production AI services initialized successfully',
        productionMode: true,
        nativeSupport: true,
        services: serviceStatus,
        models: {
          chat: await localModelClient.isModelAvailable('chat'),
          llm: await localModelClient.isModelAvailable('llm')
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Failed to initialize production AI services:', error.message);
      this.initialized = false;
      this.initializationPromise = null;
      
      this.errors.push({
        type: 'initialization',
        message: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw new Error(`Production AI initialization failed: ${error.message}`);
    }
  }

  /**
   * Get comprehensive production status
   */
  getStatus() {
    const models = localModelClient.getStatus();
    
    return {
      initialized: this.initialized,
      productionMode: true,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      models: {
        client_status: models,
        chat_available: models.availableModels.includes('chat'),
        llm_available: models.availableModels.includes('llm'),
        loaded_models: models.loadedModels
      },
      services: {
        chat: this.services.chat.getStatus(),
        llm: this.services.llm.getStatus()
      },
      system: {
        memory: this.getMemoryUsage(),
        nodeVersion: process.version,
        platform: process.platform
      },
      performance: {
        totalRequests: this.totalRequests,
        errorCount: this.errors.length,
        errorRate: this.totalRequests > 0 ? ((this.errors.length / this.totalRequests) * 100).toFixed(2) + '%' : '0%'
      },
      config: {
        maxConcurrentRequests: AI_CONFIG.performance?.maxConcurrentRequests || 3,
        enableContentFilter: AI_CONFIG.safety?.enableContentFilter || false,
        rateLimit: AI_CONFIG.safety?.rateLimit || true,
        productionSettings: true
      }
    };
  }

  /**
   * Perform comprehensive health check
   */
  async healthCheck() {
    try {
      const health = await healthCheckService.performHealthCheck();
      
      // Add AI-specific health information
      health.ai_services = {
        initialized: this.initialized,
        productionMode: true,
        services_healthy: this.areServicesHealthy(),
        models_loaded: localModelClient.getStatus().loadedModels.length,
        native_support: localModelClient.getStatus().nativeSupport
      };

      return health;
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check if services are healthy
   */
  areServicesHealthy() {
    if (!this.initialized) {
      return false;
    }

    const chatStatus = this.services.chat.getStatus();
    const llmStatus = this.services.llm.getStatus();

    return chatStatus.initialized && llmStatus.initialized;
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // MB
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100, // MB
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
      heapUsedPercent: Math.round((usage.heapUsed / usage.heapTotal) * 100 * 100) / 100
    };
  }

  /**
   * Process chat message in production mode
   */
  async processChat(sessionId, message, options = {}) {
    this.totalRequests++;
    
    try {
      if (!this.initialized) {
        throw new Error('Production AI services not initialized');
      }

      if (!this.services.chat.initialized) {
        throw new Error('Production chat service not available');
      }

      const result = await this.services.chat.generateResponse(sessionId, message, options);
      
      if (!result.success) {
        this.recordError('chat', result.error);
        throw new Error(result.error);
      }

      return result;
    } catch (error) {
      this.recordError('chat', error.message);
      throw error; // Fail fast in production
    }
  }

  /**
   * Process main prompt with production LLM
   */
  async processPrompt(prompt, options = {}) {
    this.totalRequests++;
    
    try {
      if (!this.initialized) {
        throw new Error('Production AI services not initialized');
      }

      if (!this.services.llm.initialized) {
        throw new Error('Production LLM service not available');
      }

      const result = await this.services.llm.generateResponse(prompt, options);
      
      if (!result.success) {
        this.recordError('llm', result.error);
        throw new Error(result.error);
      }

      return result;
    } catch (error) {
      this.recordError('llm', error.message);
      throw error; // Fail fast in production
    }
  }

  /**
   * Stream chat response in production mode
   */
  async* streamChat(sessionId, message, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Production AI services not initialized');
      }

      if (!this.services.chat.initialized) {
        throw new Error('Production chat service not available for streaming');
      }

      yield* this.services.chat.streamResponse(sessionId, message, options);
    } catch (error) {
      this.recordError('chat_stream', error.message);
      yield {
        type: 'error',
        content: `Production chat streaming error: ${error.message}`,
        error: true
      };
    }
  }

  /**
   * Stream LLM response in production mode
   */
  async* streamPrompt(prompt, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Production AI services not initialized');
      }

      if (!this.services.llm.initialized) {
        throw new Error('Production LLM service not available for streaming');
      }

      yield* this.services.llm.streamResponse(prompt, options);
    } catch (error) {
      this.recordError('llm_stream', error.message);
      yield {
        type: 'error',
        content: `Production LLM streaming error: ${error.message}`,
        error: true
      };
    }
  }

  /**
   * Get available production models
   */
  async getAvailableModels() {
    try {
      const models = await localModelClient.listModels();
      const status = localModelClient.getStatus();
      
      return {
        productionMode: true,
        nativeSupport: status.nativeSupport,
        models: models,
        count: models.length,
        status: status
      };
    } catch (error) {
      throw new Error(`Failed to get production models: ${error.message}`);
    }
  }

  /**
   * Record error for analytics
   */
  recordError(service, message) {
    this.errors.push({
      service,
      message,
      timestamp: new Date().toISOString()
    });

    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors.shift();
    }
  }

  /**
   * Get production analytics
   */
  getAnalytics() {
    const recentErrors = this.errors.slice(-20); // Last 20 errors
    const errorsByService = {};
    
    this.errors.forEach(error => {
      errorsByService[error.service] = (errorsByService[error.service] || 0) + 1;
    });

    return {
      uptime: Date.now() - this.startTime,
      totalRequests: this.totalRequests,
      totalErrors: this.errors.length,
      errorRate: this.totalRequests > 0 ? ((this.errors.length / this.totalRequests) * 100).toFixed(2) + '%' : '0%',
      errorsByService,
      recentErrors,
      memoryUsage: this.getMemoryUsage(),
      servicesAnalytics: {
        chat: this.services.chat.getStatus(),
        llm: this.services.llm.getStatus()
      }
    };
  }

  /**
   * Production cleanup and maintenance
   */
  async cleanup() {
    console.log('🧹 [PRODUCTION AI] Starting cleanup...');
    
    try {
      // Cleanup individual services
      await Promise.all([
        this.services.chat.cleanup(),
        this.services.llm.cleanup()
      ]);

      // Cleanup model client
      await localModelClient.cleanup();

      // Clear old errors (keep only last 24 hours)
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      this.errors = this.errors.filter(error => {
        const errorTime = new Date(error.timestamp).getTime();
        return errorTime > oneDayAgo;
      });

      console.log('✅ [PRODUCTION AI] Cleanup completed successfully');
    } catch (error) {
      console.error('❌ [PRODUCTION AI] Cleanup failed:', error.message);
    }
  }

  /**
   * Graceful shutdown for production
   */
  async shutdown() {
    console.log('🔄 [PRODUCTION AI] Initiating graceful shutdown...');
    
    try {
      // Wait for active requests to complete (with timeout)
      const shutdownTimeout = 30000; // 30 seconds
      const startShutdown = Date.now();
      
      while (this.hasActiveRequests() && (Date.now() - startShutdown) < shutdownTimeout) {
        console.log('⏳ Waiting for active requests to complete...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Cleanup resources
      await this.cleanup();

      this.initialized = false;
      console.log('✅ [PRODUCTION AI] Graceful shutdown completed');
    } catch (error) {
      console.error('❌ [PRODUCTION AI] Shutdown error:', error.message);
    }
  }

  /**
   * Check if there are active requests
   */
  hasActiveRequests() {
    const chatActive = this.services.chat.getStatus().activeRequests || 0;
    const llmActive = this.services.llm.getStatus().activeRequests || 0;
    return chatActive > 0 || llmActive > 0;
  }
}

// Export production singleton instance
export const aiService = new AIService();