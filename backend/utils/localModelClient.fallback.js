import fs from 'fs-extra';
import path from 'path';

/**
 * Fallback Local Model Client
 * This is a temporary fallback when node-llama-cpp has compatibility issues
 */
class LocalModelClientFallback {
  constructor() {
    this.loadedModels = new Map();
    this.modelPaths = new Map();
    this.isInitialized = false;
    
    console.log('⚠️  Using fallback model client due to node-llama-cpp compatibility issues');
    console.log('🔄 This client will provide mock responses while we resolve the native binary issues');
  }

  /**
   * Initialize fallback client
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        return { success: true, message: 'Fallback client already initialized' };
      }

      console.log('🔍 Initializing fallback local model client...');
      console.log('⚠️  Note: This is a temporary fallback implementation');
      
      // Check if model files exist
      const chatDir = path.resolve('./models/chat/');
      const llmDir = path.resolve('./models/llm/');
      
      await fs.ensureDir(chatDir);
      await fs.ensureDir(llmDir);
      
      const chatModels = await this.scanModelDirectory(chatDir);
      const llmModels = await this.scanModelDirectory(llmDir);
      
      console.log(`📁 Found ${chatModels.length} chat models and ${llmModels.length} LLM models`);
      
      // Set up mock model references
      if (chatModels.length > 0) {
        this.modelPaths.set('chat', chatModels[0]);
        console.log(`✅ Chat model available: ${chatModels[0].name}`);
      }
      
      if (llmModels.length > 0) {
        this.modelPaths.set('llm', llmModels[0]);
        console.log(`✅ LLM model available: ${llmModels[0].name}`);
      }
      
      this.isInitialized = true;
      console.log('✅ Fallback client initialized successfully');
      console.log('📋 Note: Responses will be mock responses until node-llama-cpp is fixed');
      
      return {
        success: true,
        chatModel: this.modelPaths.get('chat'),
        llmModel: this.modelPaths.get('llm'),
        fallback: true
      };
    } catch (error) {
      console.error('Failed to initialize fallback client:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Scan directory for model files
   */
  async scanModelDirectory(directory) {
    try {
      if (!(await fs.pathExists(directory))) {
        console.log(`📂 Directory does not exist: ${directory}`);
        return [];
      }

      const files = await fs.readdir(directory);
      const modelFiles = files.filter(file => {
        if (file.toLowerCase().includes('readme')) return false;
        return file.endsWith('.gguf') || file.includes('llama') || file.includes('phi') || file.includes('tinyllama');
      });

      const modelInfos = [];
      for (const file of modelFiles) {
        try {
          const filePath = path.join(directory, file);
          const stats = await fs.stat(filePath);
          
          if (stats.size > 10 * 1024 * 1024) {
            modelInfos.push({
              name: file,
              path: filePath,
              size: stats.size
            });
          }
        } catch (error) {
          console.warn(`Could not stat file ${file}:`, error.message);
        }
      }

      return modelInfos;
    } catch (error) {
      console.warn(`Failed to scan directory ${directory}:`, error.message);
      return [];
    }
  }

  /**
   * Check if a model is available
   */
  async isModelAvailable(modelType) {
    const modelInfo = this.modelPaths.get(modelType);
    if (!modelInfo) return false;
    
    return await fs.pathExists(modelInfo.path);
  }

  /**
   * Generate mock response (fallback implementation)
   */
  async generate(modelType, prompt, options = {}) {
    try {
      const modelInfo = this.modelPaths.get(modelType);
      if (!modelInfo) {
        throw new Error(`No ${modelType} model available`);
      }

      console.log(`🤖 [FALLBACK] Mock generation for model: ${modelInfo.name}`);
      console.log(`💭 [FALLBACK] Prompt: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}"`);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate a helpful mock response
      const mockResponses = {
        chat: [
          "Hello! I'm a mock response from the fallback chat model. The actual model loading is experiencing compatibility issues with node-llama-cpp native binaries.",
          "Hi there! This is a temporary response while we resolve the 'Illegal instruction' error with the GGUF model loader.",
          "Greetings! I'm responding from the fallback system. The real TinyLlama model will be available once we fix the CPU instruction compatibility issue."
        ],
        llm: [
          "This is a mock response from the fallback LLM system. The actual Llama-3.2-3B model encountered native binary compatibility issues.",
          "I'm providing this placeholder response while we address the node-llama-cpp CPU instruction compatibility problem.",
          "This temporary response is generated while we resolve the 'Illegal instruction' error that prevents proper model loading."
        ]
      };

      const responses = mockResponses[modelType] || mockResponses.chat;
      const response = responses[Math.floor(Math.random() * responses.length)];
      
      console.log(`✅ [FALLBACK] Generated mock response (${response.length} chars)`);
      
      return response;
      
    } catch (error) {
      console.error(`Fallback generation failed:`, error.message);
      throw error;
    }
  }

  /**
   * Chat method (fallback)
   */
  async chat(modelType, messages, options = {}) {
    try {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'user') {
        return this.generate(modelType, lastMessage.content, options);
      }
      throw new Error('No user message found in conversation');
    } catch (error) {
      console.error(`Fallback chat generation failed:`, error.message);
      throw error;
    }
  }

  /**
   * Stream generation (fallback)
   */
  async* generateStream(modelType, prompt, options = {}) {
    try {
      console.log(`🤖 [FALLBACK] Mock streaming for model: ${modelType}`);
      
      const response = await this.generate(modelType, prompt, options);
      const words = response.split(' ');
      
      // Simulate streaming by yielding words
      for (let i = 0; i < words.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        yield {
          type: 'content',
          content: words[i] + (i < words.length - 1 ? ' ' : ''),
          done: false
        };
      }
      
      yield {
        type: 'content',
        content: response,
        done: true
      };
      
    } catch (error) {
      yield {
        type: 'error',
        content: error.message
      };
    }
  }

  /**
   * Cleanup (no-op for fallback)
   */
  async cleanup() {
    console.log('🧹 [FALLBACK] Cleanup completed (no-op)');
    this.loadedModels.clear();
  }

  /**
   * List models
   */
  async listModels() {
    const models = [];
    
    for (const [type, modelInfo] of this.modelPaths.entries()) {
      if (modelInfo) {
        models.push({
          name: `${modelInfo.name} (fallback)`,
          type: type,
          size: modelInfo.size || 0,
          path: modelInfo.path,
          fallback: true
        });
      }
    }
    
    return models;
  }

  /**
   * Check availability
   */
  async isAvailable() {
    const chatAvailable = await this.isModelAvailable('chat');
    const llmAvailable = await this.isModelAvailable('llm');
    return chatAvailable || llmAvailable;
  }
}

// Export singleton instance
export const localModelClientFallback = new LocalModelClientFallback();