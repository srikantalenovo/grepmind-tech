import fs from 'fs-extra';
import path from 'path';
import { AI_CONFIG, MODEL_STATUS } from '../config/aiConfig.js';
import { ollamaClient } from './ollamaClient.js';

class ModelLoader {
  constructor() {
    this.models = new Map();
    this.modelStatus = new Map();
    this.loadQueue = [];
    this.isProcessingQueue = false;
    
    // Initialize model status
    Object.keys(AI_CONFIG.models).forEach(modelKey => {
      this.modelStatus.set(modelKey, MODEL_STATUS.UNLOADED);
    });
  }

  /**
   * Get current status of a model
   */
  getModelStatus(modelKey) {
    return this.modelStatus.get(modelKey) || MODEL_STATUS.UNLOADED;
  }

  /**
   * Get all model statuses
   */
  getAllModelStatuses() {
    const statuses = {};
    this.modelStatus.forEach((status, key) => {
      statuses[key] = {
        status,
        config: AI_CONFIG.models[key],
        loaded: status === MODEL_STATUS.LOADED
      };
    });
    return statuses;
  }

  /**
   * Check if Ollama is available and model exists
   */
  async validateOllamaModel(modelConfig) {
    try {
      // Check if Ollama is running
      const isAvailable = await ollamaClient.isAvailable();
      if (!isAvailable) {
        console.warn('Ollama is not available. Make sure Ollama is running.');
        return false;
      }

      // Check if the specific model exists
      const modelExists = await ollamaClient.modelExists(modelConfig.ollamaModel);
      if (!modelExists) {
        console.warn(`Model '${modelConfig.ollamaModel}' not found in Ollama.`);
        
        // Try fallback models
        if (modelConfig.fallbackModels && modelConfig.fallbackModels.length > 0) {
          for (const fallbackModel of modelConfig.fallbackModels) {
            const fallbackExists = await ollamaClient.modelExists(fallbackModel);
            if (fallbackExists) {
              console.log(`Using fallback model: ${fallbackModel}`);
              modelConfig.ollamaModel = fallbackModel;
              return true;
            }
          }
        }
        
        console.warn(`No suitable models found. Available models:`);
        const availableModels = await ollamaClient.listModels();
        availableModels.forEach(model => console.log(`  - ${model.name}`));
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error validating Ollama model: ${error.message}`);
      return false;
    }
  }

  /**
   * Load a specific model
   */
  async loadModel(modelKey) {
    if (!AI_CONFIG.models[modelKey]) {
      throw new Error(`Model configuration not found: ${modelKey}`);
    }

    const modelConfig = AI_CONFIG.models[modelKey];
    
    try {
      this.modelStatus.set(modelKey, MODEL_STATUS.LOADING);
      console.log(`🤖 Loading model: ${modelKey} (${modelConfig.ollamaModel})`);

      // Validate Ollama model availability
      const isValid = await this.validateOllamaModel(modelConfig);
      if (!isValid) {
        throw new Error(`Model '${modelConfig.ollamaModel}' is not available in Ollama`);
      }

      // Create model wrapper with Ollama integration
      const modelWrapper = this.createModelWrapper(modelKey, modelConfig);

      // Test the model with a simple prompt
      await this.testModel(modelWrapper, modelConfig.type);

      // Store the model
      this.models.set(modelKey, modelWrapper);
      this.modelStatus.set(modelKey, MODEL_STATUS.LOADED);
      
      console.log(`✅ Model loaded successfully: ${modelKey} (${modelConfig.ollamaModel})`);

      return {
        success: true,
        modelKey,
        status: MODEL_STATUS.LOADED,
        config: modelConfig,
        ollamaModel: modelConfig.ollamaModel
      };

    } catch (error) {
      this.modelStatus.set(modelKey, MODEL_STATUS.ERROR);
      console.error(`❌ Failed to load model ${modelKey}:`, error.message);
      throw error;
    }
  }

  /**
   * Create model wrapper for Ollama integration
   */
  createModelWrapper(modelKey, modelConfig) {
    return {
      name: modelConfig.ollamaModel,
      type: modelConfig.type,
      loaded: true,
      config: modelConfig,
      
      // Generate response using Ollama
      generate: async (input, options = {}) => {
        try {
          const mergedOptions = {
            temperature: options.temperature || modelConfig.temperature,
            maxTokens: options.maxTokens || modelConfig.maxTokens,
            topP: options.topP || 0.9,
            topK: options.topK || 40,
            stopSequences: options.stopSequences || []
          };

          console.log(`🔥 Generating with ${modelConfig.ollamaModel}...`);
          const result = await ollamaClient.generate(modelConfig.ollamaModel, input, mergedOptions);
          
          if (result.success) {
            return result.response;
          } else {
            throw new Error(result.error);
          }
        } catch (error) {
          console.error(`Error generating with model ${modelKey}:`, error.message);
          throw error;
        }
      },

      // Generate chat response using Ollama
      chat: async (messages, options = {}) => {
        try {
          const mergedOptions = {
            temperature: options.temperature || modelConfig.temperature,
            maxTokens: options.maxTokens || modelConfig.maxTokens,
            topP: options.topP || 0.9,
            topK: options.topK || 40
          };

          const result = await ollamaClient.chat(modelConfig.ollamaModel, messages, mergedOptions);
          
          if (result.success) {
            return result.message.content;
          } else {
            throw new Error(result.error);
          }
        } catch (error) {
          console.error(`Error chatting with model ${modelKey}:`, error.message);
          throw error;
        }
      },

      // Stream response
      stream: async function* (input, options = {}) {
        try {
          const mergedOptions = {
            temperature: options.temperature || modelConfig.temperature,
            maxTokens: options.maxTokens || modelConfig.maxTokens,
            topP: options.topP || 0.9,
            topK: options.topK || 40,
            stopSequences: options.stopSequences || []
          };

          yield* ollamaClient.generateStream(modelConfig.ollamaModel, input, mergedOptions);
        } catch (error) {
          console.error(`Error streaming with model ${modelKey}:`, error.message);
          yield { type: 'error', content: error.message };
        }
      },

      // Dispose method
      dispose: async () => {
        console.log(`🗑️ Disposing model: ${modelKey}`);
        // No need to dispose Ollama models as they're managed by Ollama service
      }
    };
  }

  /**
   * Test model with a simple prompt
   */
  async testModel(modelWrapper, modelType) {
    try {
      console.log(`🧪 Testing model...`);
      
      const testPrompt = modelType === 'conversational' 
        ? "Hi! Please respond with 'Hello' to confirm you're working."
        : "Please respond with 'OK' to confirm you're working.";

      const response = await modelWrapper.generate(testPrompt, { maxTokens: 10 });
      
      if (!response || response.trim().length === 0) {
        throw new Error('Model test failed: empty response');
      }
      
      console.log(`✅ Model test successful. Response: "${response.slice(0, 50)}..."`);
    } catch (error) {
      console.error(`❌ Model test failed:`, error.message);
      throw new Error(`Model test failed: ${error.message}`);
    }
  }

  /**
   * Unload a model
   */
  async unloadModel(modelKey) {
    try {
      const model = this.models.get(modelKey);
      if (model && model.dispose) {
        await model.dispose();
      }
      
      this.models.delete(modelKey);
      this.modelStatus.set(modelKey, MODEL_STATUS.UNLOADED);
      
      console.log(`🗑️ Model unloaded: ${modelKey}`);
      return { success: true, modelKey };
    } catch (error) {
      console.error(`Failed to unload model ${modelKey}:`, error);
      throw error;
    }
  }

  /**
   * Load all available models
   */
  async loadAllModels() {
    console.log('🚀 Loading all AI models...');
    
    // First check if Ollama is available
    const ollamaAvailable = await ollamaClient.isAvailable();
    if (!ollamaAvailable) {
      console.error('❌ Ollama is not available. Please start Ollama first.');
      return [{
        success: false,
        error: 'Ollama is not available. Please start Ollama service.',
        instructions: [
          '1. Make sure Ollama is installed',
          '2. Start Ollama service',
          '3. Pull required models (e.g., ollama pull phi3:mini)'
        ]
      }];
    }

    const results = [];
    for (const modelKey of Object.keys(AI_CONFIG.models)) {
      try {
        const result = await this.loadModel(modelKey);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          modelKey,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`📊 Model loading completed: ${successCount}/${totalCount} successful`);
    
    return results;
  }

  /**
   * Get loaded model instance
   */
  getModel(modelKey) {
    if (this.modelStatus.get(modelKey) !== MODEL_STATUS.LOADED) {
      throw new Error(`Model not loaded: ${modelKey}`);
    }
    return this.models.get(modelKey);
  }

  /**
   * Check if model is ready for inference
   */
  isModelReady(modelKey) {
    return this.modelStatus.get(modelKey) === MODEL_STATUS.LOADED;
  }

  /**
   * Initialize models directory structure (for local backup)
   */
  async initializeModelsDirectory() {
    try {
      const baseDir = path.resolve('./models');
      await fs.ensureDir(baseDir);
      
      // Create subdirectories for each model type
      for (const [modelKey, config] of Object.entries(AI_CONFIG.models)) {
        const modelDir = path.resolve(config.modelPath);
        await fs.ensureDir(modelDir);
        
        // Create info file about Ollama integration
        const infoPath = path.join(modelDir, 'README.md');
        if (!(await fs.pathExists(infoPath))) {
          await fs.writeFile(infoPath, 
            `# ${config.name} Model\n\n` +
            `**Ollama Model:** \`${config.ollamaModel}\`\n` +
            `**Type:** ${config.type}\n` +
            `**Description:** ${config.description}\n\n` +
            `## Setup Instructions\n\n` +
            `1. Install Ollama: https://ollama.ai\n` +
            `2. Pull the model: \`ollama pull ${config.ollamaModel}\`\n` +
            `3. Start the backend server\n\n` +
            `## Fallback Models\n\n` +
            `${config.fallbackModels ? config.fallbackModels.map(m => `- \`${m}\``).join('\n') : 'None configured'}\n\n` +
            `This directory can be used for local model files as backup.`
          );
        }
      }
      
      console.log('📁 Models directory structure initialized');
    } catch (error) {
      console.error('Failed to initialize models directory:', error);
    }
  }

  /**
   * Get available Ollama models
   */
  async getAvailableOllamaModels() {
    try {
      return await ollamaClient.listModels();
    } catch (error) {
      console.error('Failed to get Ollama models:', error.message);
      return [];
    }
  }

  /**
   * Pull model from Ollama registry
   */
  async pullOllamaModel(modelName) {
    try {
      console.log(`📥 Pulling Ollama model: ${modelName}`);
      return await ollamaClient.pullModel(modelName);
    } catch (error) {
      console.error(`Failed to pull model ${modelName}:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const modelLoader = new ModelLoader();