import fs from 'fs-extra';
import path from 'path';
import { AI_CONFIG, MODEL_STATUS } from '../config/aiConfig.js';
import { ollamaClient } from './ollamaClient.js';
import { localModelClient } from './localModelClient.js';

class ModelLoader {
  constructor() {
    this.models = new Map();
    this.modelStatus = new Map();
    this.loadQueue = [];
    this.isProcessingQueue = false;
    this.usingLocalFallback = false;
    
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
        loaded: status === MODEL_STATUS.LOADED,
        usingLocal: this.usingLocalFallback
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
        console.warn('🔴 Ollama is not available.');
        return false;
      }

      // Check if the specific model exists
      const modelExists = await ollamaClient.modelExists(modelConfig.ollamaModel);
      if (!modelExists) {
        console.warn(`🔴 Model '${modelConfig.ollamaModel}' not found in Ollama.`);
        
        // Try fallback models
        if (modelConfig.fallbackModels && modelConfig.fallbackModels.length > 0) {
          for (const fallbackModel of modelConfig.fallbackModels) {
            const fallbackExists = await ollamaClient.modelExists(fallbackModel);
            if (fallbackExists) {
              console.log(`🟡 Using fallback model: ${fallbackModel}`);
              modelConfig.ollamaModel = fallbackModel;
              return true;
            }
          }
        }
        
        console.warn(`🔴 No suitable Ollama models found.`);
        const availableModels = await ollamaClient.listModels();
        if (availableModels.length > 0) {
          console.log('📋 Available Ollama models:');
          availableModels.forEach(model => console.log(`  - ${model.name}`));
        } else {
          console.log('📋 No models installed in Ollama');
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error(`🔴 Error validating Ollama model: ${error.message}`);
      return false;
    }
  }

  /**
   * Load a specific model (with fallback to local files)
   */
  async loadModel(modelKey) {
    if (!AI_CONFIG.models[modelKey]) {
      throw new Error(`Model configuration not found: ${modelKey}`);
    }

    const modelConfig = AI_CONFIG.models[modelKey];
    
    try {
      this.modelStatus.set(modelKey, MODEL_STATUS.LOADING);
      console.log(`🤖 Loading model: ${modelKey}`);

      // First, try Ollama
      let useOllama = false;
      if (!this.usingLocalFallback) {
        console.log(`🔍 Trying Ollama for ${modelKey}...`);
        useOllama = await this.validateOllamaModel(modelConfig);
      }

      let modelWrapper;
      
      if (useOllama) {
        console.log(`✅ Using Ollama for ${modelKey}: ${modelConfig.ollamaModel}`);
        modelWrapper = this.createOllamaModelWrapper(modelKey, modelConfig);
      } else {
        // Fallback to local models
        console.log(`🔄 Falling back to local models for ${modelKey}...`);
        
        if (!modelConfig.useLocalFallback) {
          throw new Error(`Local fallback disabled for model: ${modelKey}`);
        }
        
        // Initialize local model client if not done yet
        if (!this.usingLocalFallback) {
          console.log('🔧 Initializing local model client...');
          const initResult = await localModelClient.initialize();
          if (!initResult.success) {
            throw new Error(`Failed to initialize local models: ${initResult.error}`);
          }
          this.usingLocalFallback = true;
        }
        
        // Check if local model is available
        const localAvailable = await localModelClient.isModelAvailable(modelKey);
        if (!localAvailable) {
          throw new Error(`No local model files found for ${modelKey} in ${modelConfig.modelPath}`);
        }
        
        console.log(`✅ Using local files for ${modelKey}`);
        modelWrapper = this.createLocalModelWrapper(modelKey, modelConfig);
      }

      // Test the model
      await this.testModel(modelWrapper, modelConfig.type);

      // Store the model
      this.models.set(modelKey, modelWrapper);
      this.modelStatus.set(modelKey, MODEL_STATUS.LOADED);
      
      console.log(`🎉 Model loaded successfully: ${modelKey}`);

      return {
        success: true,
        modelKey,
        status: MODEL_STATUS.LOADED,
        config: modelConfig,
        usingOllama: useOllama,
        usingLocal: !useOllama,
        modelName: useOllama ? modelConfig.ollamaModel : 'Local Model'
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
  createOllamaModelWrapper(modelKey, modelConfig) {
    return {
      name: modelConfig.ollamaModel,
      type: modelConfig.type,
      loaded: true,
      config: modelConfig,
      source: 'ollama',
      
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

          const result = await ollamaClient.generate(modelConfig.ollamaModel, input, mergedOptions);
          
          if (result.success) {
            return result.response;
          } else {
            throw new Error(result.error);
          }
        } catch (error) {
          console.error(`Error generating with Ollama model ${modelKey}:`, error.message);
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
          console.error(`Error chatting with Ollama model ${modelKey}:`, error.message);
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
          console.error(`Error streaming with Ollama model ${modelKey}:`, error.message);
          yield { type: 'error', content: error.message };
        }
      },

      dispose: async () => {
        console.log(`🗑️ Disposing Ollama model: ${modelKey}`);
      }
    };
  }

  /**
   * Create model wrapper for local files
   */
  createLocalModelWrapper(modelKey, modelConfig) {
    return {
      name: `Local ${modelConfig.name}`,
      type: modelConfig.type,
      loaded: true,
      config: modelConfig,
      source: 'local',
      
      // Generate response using local model
      generate: async (input, options = {}) => {
        try {
          return await localModelClient.generate(modelKey, input, options);
        } catch (error) {
          console.error(`Error generating with local model ${modelKey}:`, error.message);
          throw error;
        }
      },

      // Generate chat response using local model
      chat: async (messages, options = {}) => {
        try {
          return await localModelClient.chat(modelKey, messages, options);
        } catch (error) {
          console.error(`Error chatting with local model ${modelKey}:`, error.message);
          throw error;
        }
      },

      // Stream response
      stream: async function* (input, options = {}) {
        try {
          yield* localModelClient.generateStream(modelKey, input, options);
        } catch (error) {
          console.error(`Error streaming with local model ${modelKey}:`, error.message);
          yield { type: 'error', content: error.message };
        }
      },

      dispose: async () => {
        console.log(`🗑️ Disposing local model: ${modelKey}`);
      }
    };
  }

  /**
   * Test model with a simple prompt
   */
  async testModel(modelWrapper, modelType) {
    try {
      console.log(`🧪 Testing model (${modelWrapper.source})...`);
      
      const testPrompt = modelType === 'conversational' 
        ? "Hello"
        : "Test";

      const response = await modelWrapper.generate(testPrompt, { maxTokens: 20 });
      
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
      console.log('🟡 Ollama not available, will use local model fallback');
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
    
    if (this.usingLocalFallback) {
      console.log('🔄 Using local model files as fallback');
    }
    
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
        
        // Create info file about model setup
        const infoPath = path.join(modelDir, 'README.md');
        if (!(await fs.pathExists(infoPath))) {
          await fs.writeFile(infoPath, 
            `# ${config.name} Model\n\n` +
            `**Preferred Ollama Model:** \`${config.ollamaModel}\`\n` +
            `**Type:** ${config.type}\n` +
            `**Description:** ${config.description}\n\n` +
            `## Setup Options\n\n` +
            `### Option 1: Ollama (Recommended)\n` +
            `1. Install Ollama: https://ollama.ai\n` +
            `2. Pull the model: \`ollama pull ${config.ollamaModel}\`\n` +
            `3. Start Ollama: \`ollama serve\`\n\n` +
            `### Option 2: Local Files (Fallback)\n` +
            `1. Place GGUF model files in this directory\n` +
            `2. The system will automatically detect and use them\n` +
            `3. Supported formats: .gguf files\n\n` +
            `## Fallback Models\n\n` +
            `${config.fallbackModels ? config.fallbackModels.map(m => `- \`${m}\``).join('\n') : 'None configured'}\n\n` +
            `The system will try Ollama first, then fallback to local files if available.`
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

  /**
   * Get available local model files
   */
  async getAvailableLocalModels() {
    try {
      return await localModelClient.listModels();
    } catch (error) {
      console.error('Failed to get local models:', error.message);
      return [];
    }
  }

  /**
   * Get system status including both Ollama and local capabilities
   */
  getSystemStatus() {
    return {
      usingLocalFallback: this.usingLocalFallback,
      modelStatuses: this.getAllModelStatuses(),
      ollamaAvailable: !this.usingLocalFallback,
      localModelsAvailable: this.usingLocalFallback
    };
  }
}

// Export singleton instance
export const modelLoader = new ModelLoader();