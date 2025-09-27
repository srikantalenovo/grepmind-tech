import fs from 'fs-extra';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { langchainModelClient } from './langchainModelClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Production Local GGUF Model Client (LangChain-powered)
 * Uses LangChain for stable and reliable model inference
 */
class LocalModelClient {
  constructor() {
    this.langchainClient = langchainModelClient;
    this.isInitialized = false;
  }

  /**
   * Initialize the model client using LangChain
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        return { success: true, message: 'Already initialized' };
      }

      console.log('🚀 Initializing Production GGUF Model Client (LangChain-powered)...');
      
      // Delegate to LangChain client
      const result = await this.langchainClient.initialize();
      
      this.isInitialized = result.success;
      console.log('🎉 Production model client initialized successfully with LangChain');
      
      return {
        success: true,
        chatModel: result.chatModel,
        llmModel: result.llmModel,
        productionMode: true,
        langchainPowered: true,
        nativeSupport: result.langchainSupport
      };
    } catch (error) {
      console.error('❌ Failed to initialize LangChain model client:', error.message);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Generate response using LangChain
   */
  async generate(modelType, prompt, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('Model client not initialized. Call initialize() first.');
      }

      console.log(`🤖 [PRODUCTION-LANGCHAIN] Generating with model type: ${modelType}`);
      
      const response = await this.langchainClient.generate(modelType, prompt, options);
      
      console.log(`✅ [PRODUCTION-LANGCHAIN] Response generated successfully`);
      
      return response;
      
    } catch (error) {
      console.error(`❌ [PRODUCTION-LANGCHAIN] Model generation failed:`, error.message);
      throw new Error(`Production LangChain inference failed: ${error.message}`);
    }
  }

  /**
   * Chat interface
   */
  async chat(modelType, messages, options = {}) {
    try {
      return await this.langchainClient.chat(modelType, messages, options);
    } catch (error) {
      console.error(`❌ [PRODUCTION-LANGCHAIN] Chat generation failed:`, error.message);
      throw error;
    }
  }

  /**
   * Streaming generation using LangChain
   */
  async* generateStream(modelType, prompt, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('Production streaming requires initialized LangChain model support');
      }

      console.log(`🤖 [PRODUCTION-LANGCHAIN] Starting stream for model type: ${modelType}`);
      
      for await (const chunk of this.langchainClient.generateStream(modelType, prompt, options)) {
        yield chunk;
      }
      
    } catch (error) {
      console.error(`❌ [PRODUCTION-LANGCHAIN] Streaming failed:`, error.message);
      yield {
        type: 'error',
        content: `Production LangChain streaming error: ${error.message}`,
        error: true
      };
    }
  }

  /**
   * Check if model is available
   */
  async isModelAvailable(modelType) {
    if (!this.isInitialized) {
      return false;
    }
    
    return await this.langchainClient.isModelAvailable(modelType);
  }

  /**
   * List available models
   */
  async listModels() {
    if (!this.isInitialized) {
      throw new Error('Model client not initialized');
    }
    
    return await this.langchainClient.listModels();
  }

  /**
   * Check availability
   */
  async isAvailable() {
    if (!this.isInitialized) {
      return false;
    }
    
    return await this.langchainClient.isAvailable();
  }

  /**
   * Get system status
   */
  getStatus() {
    const langchainStatus = this.langchainClient.getStatus();
    
    return {
      initialized: this.isInitialized,
      langchainPowered: true,
      langchainSupport: langchainStatus.langchainSupport,
      loadedModels: langchainStatus.loadedModels,
      availableModels: langchainStatus.availableModels,
      productionMode: true,
      fallbackMode: false
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('🧹 [PRODUCTION-LANGCHAIN] Cleaning up model resources...');
    
    try {
      await this.langchainClient.cleanup();
      console.log('✅ Production LangChain cleanup completed');
    } catch (error) {
      console.warn('⚠️  Failed to cleanup LangChain resources:', error.message);
    }
  }

  // Legacy compatibility methods (delegate to LangChain client)
  
  async validateModelIntegrity() {
    return await this.langchainClient.validateModelIntegrity();
  }

  async ensureModelAvailable(modelType, existingModels, directory) {
    return await this.langchainClient.ensureModelAvailable(modelType, existingModels, directory);
  }

  async downloadModel(url, filepath, expectedSize) {
    return await this.langchainClient.downloadModel(url, filepath, expectedSize);
  }

  async scanModelDirectory(directory) {
    return await this.langchainClient.scanModelDirectory(directory);
  }
}

// Export production singleton instance
export const localModelClient = new LocalModelClient();