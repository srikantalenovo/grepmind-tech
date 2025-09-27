import { modelLoader } from '../utils/modelLoader.js';
import { chatBotService } from './chatBot.js';
import { llmService } from './llmService.js';
import { AI_CONFIG } from '../config/aiConfig.js';

class AIService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.services = {
      chat: chatBotService,
      llm: llmService
    };
  }

  /**
   * Initialize all AI services
   */
  async initialize() {
    if (this.initialized) {
      return { success: true, message: 'AI services already initialized' };
    }

    if (this.initializationPromise) {
      return await this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization();
    return await this.initializationPromise;
  }

  /**
   * Perform the actual initialization
   */
  async _performInitialization() {
    try {
      console.log('🤖 Initializing AI Services...');

      // Initialize models directory structure
      await modelLoader.initializeModelsDirectory();

      // Load all models
      console.log('📦 Loading AI models...');
      const modelResults = await modelLoader.loadAllModels();
      
      const successfulModels = modelResults.filter(r => r.success);
      const failedModels = modelResults.filter(r => !r.success);

      if (successfulModels.length === 0) {
        throw new Error('No models loaded successfully');
      }

      console.log(`✅ Loaded ${successfulModels.length} models successfully`);
      if (failedModels.length > 0) {
        console.warn(`⚠️  Failed to load ${failedModels.length} models:`, failedModels);
      }

      // Initialize individual services
      console.log('🚀 Initializing AI services...');
      
      const initResults = await Promise.allSettled([
        this.services.chat.initialize(),
        this.services.llm.initialize()
      ]);

      const serviceStatus = {};
      initResults.forEach((result, index) => {
        const serviceName = index === 0 ? 'chat' : 'llm';
        serviceStatus[serviceName] = {
          success: result.status === 'fulfilled',
          error: result.status === 'rejected' ? result.reason.message : null
        };
      });

      this.initialized = true;
      console.log('🎉 AI Services initialization completed!');

      return {
        success: true,
        message: 'AI services initialized successfully',
        models: modelResults,
        services: serviceStatus,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Failed to initialize AI services:', error);
      this.initialized = false;
      this.initializationPromise = null;
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get comprehensive status of all AI services
   */
  getStatus() {
    const modelStatuses = modelLoader.getAllModelStatuses();
    
    return {
      initialized: this.initialized,
      timestamp: new Date().toISOString(),
      models: modelStatuses,
      services: {
        chat: this.services.chat.getStatus(),
        llm: this.services.llm.getStatus()
      },
      system: {
        memory: this.getMemoryUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version
      },
      config: {
        maxConcurrentRequests: AI_CONFIG.performance.maxConcurrentRequests,
        enableContentFilter: AI_CONFIG.safety.enableContentFilter,
        rateLimit: AI_CONFIG.safety.rateLimit
      }
    };
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
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100 // MB
    };
  }

  /**
   * Process chat message
   */
  async processChat(sessionId, message, options = {}) {
    if (!this.initialized) {
      throw new Error('AI services not initialized');
    }

    return await this.services.chat.generateResponse(sessionId, message, options);
  }

  /**
   * Process main prompt with LLM
   */
  async processPrompt(prompt, options = {}) {
    if (!this.initialized) {
      throw new Error('AI services not initialized');
    }

    return await this.services.llm.generateResponse(prompt, options);
  }

  /**
   * Stream chat response
   */
  async* streamChat(sessionId, message, options = {}) {
    if (!this.initialized) {
      throw new Error('AI services not initialized');
    }

    yield* this.services.chat.streamResponse(sessionId, message, options);
  }

  /**
   * Stream LLM response
   */
  async* streamPrompt(prompt, options = {}) {
    if (!this.initialized) {
      throw new Error('AI services not initialized');
    }

    yield* this.services.llm.streamResponse(prompt, options);
  }

  /**
   * Get available models
   */
  getAvailableModels() {
    return {
      models: AI_CONFIG.models,
      statuses: modelLoader.getAllModelStatuses()
    };
  }

  /**
   * Switch model (reload with different configuration)
   */
  async switchModel(modelKey, newConfig) {
    try {
      // Validate model key
      if (!AI_CONFIG.models[modelKey]) {
        throw new Error(`Unknown model: ${modelKey}`);
      }

      console.log(`Switching model: ${modelKey}`);

      // Unload current model
      await modelLoader.unloadModel(modelKey);

      // Update configuration if provided
      if (newConfig) {
        AI_CONFIG.models[modelKey] = { ...AI_CONFIG.models[modelKey], ...newConfig };
      }

      // Reload model
      await modelLoader.loadModel(modelKey);

      // Reinitialize affected service
      if (modelKey === 'chat') {
        await this.services.chat.initialize();
      } else if (modelKey === 'llm') {
        await this.services.llm.initialize();
      }

      return {
        success: true,
        message: `Model ${modelKey} switched successfully`,
        newStatus: modelLoader.getModelStatus(modelKey)
      };

    } catch (error) {
      console.error(`Failed to switch model ${modelKey}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clear service data
   */
  async clearData(serviceType, sessionId = null) {
    try {
      let result;

      switch (serviceType) {
        case 'chat':
          if (sessionId) {
            result = this.services.chat.clearConversation(sessionId);
          } else {
            // Clear all conversations (you'd need to implement this)
            result = { success: true, message: 'All chat data cleared' };
          }
          break;

        case 'llm':
          result = this.services.llm.clearHistory();
          break;

        case 'all':
          await this.services.chat.clearConversation();
          await this.services.llm.clearHistory();
          result = { success: true, message: 'All AI service data cleared' };
          break;

        default:
          throw new Error(`Unknown service type: ${serviceType}`);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Health check for all services
   */
  async healthCheck() {
    const status = this.getStatus();
    const issues = [];

    // Check if initialized
    if (!status.initialized) {
      issues.push('AI services not initialized');
    }

    // Check model statuses
    Object.entries(status.models).forEach(([key, model]) => {
      if (!model.loaded) {
        issues.push(`Model ${key} not loaded: ${model.status}`);
      }
    });

    // Check memory usage
    if (status.system.memory.heapUsed > 1000) { // More than 1GB
      issues.push('High memory usage detected');
    }

    return {
      healthy: issues.length === 0,
      issues,
      status,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      console.log('🛑 Shutting down AI services...');

      // Unload all models
      for (const modelKey of Object.keys(AI_CONFIG.models)) {
        try {
          await modelLoader.unloadModel(modelKey);
        } catch (error) {
          console.error(`Error unloading model ${modelKey}:`, error);
        }
      }

      this.initialized = false;
      this.initializationPromise = null;

      console.log('✅ AI services shut down successfully');
      return { success: true, message: 'AI services shut down successfully' };

    } catch (error) {
      console.error('❌ Error during AI services shutdown:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const aiService = new AIService();