import fs from 'fs-extra';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { LlamaCpp } from "@langchain/community/llms/llama_cpp";

// Try to import LangChain components with graceful fallback
let ChatLlamaCpp, langchainAvailable = false;

try {
  // Try to import LangChain LlamaCpp integrations
  const langchainCommunity = await import('@langchain/community/chat_models/llama_cpp');
  const langchainLlms = await import('@langchain/community/llms/llama_cpp');
  
  ChatLlamaCpp = langchainCommunity.ChatLlamaCpp;
  LlamaCpp = langchainLlms.LlamaCpp;
  langchainAvailable = true;
  
  console.log('✅ LangChain LlamaCpp loaded successfully');
} catch (error) {
  console.log('⚠️  LangChain not available, using simulation mode');
  console.log('💡 To enable full LangChain support, install: npm install langchain @langchain/core @langchain/community');
  langchainAvailable = false;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Production LangChain GGUF Model Client
 * Uses LangChain abstractions for stable local model inference
 * Falls back to simulation mode if dependencies are not available
 */
class LangChainModelClient {
  constructor() {
    this.loadedModels = new Map();
    this.modelPaths = new Map();
    this.isInitialized = false;
    this.simulationMode = !langchainAvailable;
    
    // Production model configurations
    this.availableModels = {
      chat: {
        name: 'tinyllama-1.1b-chat',
        fileName: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
        url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
        size: '669MB',
        description: 'TinyLlama 1.1B - Fast and efficient chat model'
      },
      llm: {
        name: 'llama-3.2-3b-instruct',
        fileName: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        size: '1.9GB',
        description: 'Meta Llama 3.2 3B - Production-grade text generation'
      }
    };
  }

  /**
   * Initialize LangChain model client
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        return { success: true, message: 'Already initialized' };
      }

      console.log('🚀 Initializing LangChain GGUF Model Client...');
      
      if (this.simulationMode) {
        console.log('🔧 Running in simulation mode - LangChain dependencies not available');
        console.log('💡 Install LangChain packages for full functionality');
      } else {
        console.log('✅ LangChain model support confirmed');
      }
      
      // Ensure model directories exist
      const chatDir = path.resolve('./models/chat/');
      const llmDir = path.resolve('./models/llm/');
      
      await fs.ensureDir(chatDir);
      await fs.ensureDir(llmDir);
      
      // Scan for existing models
      const chatModels = await this.scanModelDirectory(chatDir);
      const llmModels = await this.scanModelDirectory(llmDir);
      
      console.log(`📁 Found ${chatModels.length} chat models and ${llmModels.length} LLM models`);
      
      // In simulation mode, we don't need to download large models
      if (!this.simulationMode) {
        // Ensure models are available - download if necessary
        await this.ensureModelAvailable('chat', chatModels, chatDir);
        await this.ensureModelAvailable('llm', llmModels, llmDir);
        
        // Validate that models can be loaded
        await this.validateModelIntegrity();
      } else {
        // Set up simulation models
        this.modelPaths.set('chat', { 
          name: 'simulation-chat-model', 
          path: './simulation/chat.gguf', 
          size: 0 
        });
        this.modelPaths.set('llm', { 
          name: 'simulation-llm-model', 
          path: './simulation/llm.gguf', 
          size: 0 
        });
        console.log('🎭 Simulation models configured');
      }
      
      this.isInitialized = true;
      console.log('🎉 LangChain model client initialized successfully');
      
      return {
        success: true,
        chatModel: this.modelPaths.get('chat'),
        llmModel: this.modelPaths.get('llm'),
        productionMode: !this.simulationMode,
        simulationMode: this.simulationMode,
        langchainSupport: langchainAvailable
      };
    } catch (error) {
      console.error('❌ Failed to initialize LangChain model client:', error.message);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Validate model integrity (skip in simulation mode)
   */
  async validateModelIntegrity() {
    if (this.simulationMode) {
      console.log('🎭 Skipping model validation in simulation mode');
      return;
    }

    console.log('🔍 Validating model integrity...');
    
    for (const [modelType, modelInfo] of this.modelPaths.entries()) {
      if (!modelInfo || !await fs.pathExists(modelInfo.path)) {
        throw new Error(`Model ${modelType} is not available at path: ${modelInfo?.path || 'unknown'}`);
      }
      
      const stats = await fs.stat(modelInfo.path);
      if (stats.size < 10 * 1024 * 1024) {
        throw new Error(`Model ${modelType} appears to be corrupted (size: ${stats.size} bytes)`);
      }
      
      console.log(`✅ Model ${modelType} validated: ${modelInfo.name} (${Math.round(stats.size / (1024 * 1024))}MB)`);
    }
  }

  /**
   * Ensure a model is available (skip downloads in simulation mode)
   */
  async ensureModelAvailable(modelType, existingModels, directory) {
    if (this.simulationMode) {
      return { name: `simulation-${modelType}`, path: `./simulation/${modelType}.gguf`, size: 0 };
    }

    if (existingModels.length > 0) {
      const selectedModel = existingModels[0];
      this.modelPaths.set(modelType, selectedModel);
      console.log(`✅ Using existing ${modelType} model: ${selectedModel.name}`);
      return selectedModel;
    }

    console.log(`📥 Downloading production ${modelType} model...`);
    const modelConfig = this.availableModels[modelType];
    const downloadPath = path.join(directory, modelConfig.fileName);
    
    try {
      await this.downloadModel(modelConfig.url, downloadPath, modelConfig.size);
      
      const stats = await fs.stat(downloadPath);
      const downloadedModel = {
        name: modelConfig.fileName,
        path: downloadPath,
        size: stats.size
      };
      
      this.modelPaths.set(modelType, downloadedModel);
      console.log(`✅ Production ${modelType} model ready: ${modelConfig.fileName}`);
      return downloadedModel;
    } catch (error) {
      console.error(`❌ Failed to download ${modelType} model:`, error.message);
      throw new Error(`Production model download failed for ${modelType}: ${error.message}`);
    }
  }

  /**
   * Download model with production error handling
   */
  async downloadModel(url, filepath, expectedSize) {
    return new Promise((resolve, reject) => {
      console.log(`🌐 Downloading production model: ${url}`);
      console.log(`💾 Target location: ${filepath}`);
      console.log(`📊 Expected size: ${expectedSize}`);
      
      const file = fs.createWriteStream(filepath);
      let downloadedBytes = 0;
      let lastProgressTime = Date.now();
      
      const request = https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          file.destroy();
          return this.downloadModel(response.headers.location, filepath, expectedSize)
            .then(resolve)
            .catch(reject);
        }
        
        if (response.statusCode !== 200) {
          file.destroy();
          fs.unlink(filepath).catch(() => {});
          reject(new Error(`Download failed: HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        const totalSize = parseInt(response.headers['content-length']) || 0;
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          file.write(chunk);
          
          const now = Date.now();
          if (now - lastProgressTime > 5000) {
            const percentComplete = totalSize > 0 ? (downloadedBytes / totalSize * 100).toFixed(1) : 'unknown';
            const downloadedMB = (downloadedBytes / (1024 * 1024)).toFixed(1);
            console.log(`📈 Download progress: ${downloadedMB}MB (${percentComplete}%)`);
            lastProgressTime = now;
          }
        });
        
        response.on('end', () => {
          file.end();
          const finalMB = (downloadedBytes / (1024 * 1024)).toFixed(1);
          console.log(`✅ Download completed: ${finalMB}MB`);
          resolve();
        });
        
        response.on('error', (err) => {
          file.destroy();
          fs.unlink(filepath).catch(() => {});
          reject(new Error(`Download error: ${err.message}`));
        });
      });
      
      request.on('error', (err) => {
        file.destroy();
        fs.unlink(filepath).catch(() => {});
        reject(new Error(`Request error: ${err.message}`));
      });
      
      request.setTimeout(600000, () => {
        request.destroy();
        file.destroy();
        fs.unlink(filepath).catch(() => {});
        reject(new Error('Download timeout - production models require stable connection'));
      });
    });
  }

  /**
   * Scan directory for model files
   */
  async scanModelDirectory(directory) {
    try {
      if (!(await fs.pathExists(directory))) {
        console.log(`📂 Creating model directory: ${directory}`);
        await fs.ensureDir(directory);
        return [];
      }

      const files = await fs.readdir(directory);
      console.log(`📋 Scanning ${directory}:`, files.length, 'files');
      
      const modelFiles = files.filter(file => {
        if (file.toLowerCase().includes('readme')) return false;
        
        return (
          file.endsWith('.gguf') ||
          file.includes('llama') ||
          file.includes('phi3') ||
          file.includes('qwen') ||
          file.includes('mistral') ||
          file.includes('tinyllama')
        );
      });

      const modelInfos = [];
      for (const file of modelFiles) {
        try {
          const filePath = path.join(directory, file);
          const stats = await fs.stat(filePath);
          
          if (stats.size > 50 * 1024 * 1024) {
            modelInfos.push({
              name: file,
              path: filePath,
              size: stats.size
            });
          }
        } catch (error) {
          console.warn(`⚠️  Could not validate file ${file}:`, error.message);
        }
      }

      console.log(`✅ Found ${modelInfos.length} production-ready models in ${directory}`);
      modelInfos.forEach(model => {
        const sizeMB = Math.round(model.size / (1024 * 1024));
        console.log(`  📄 ${model.name} (${sizeMB}MB)`);
      });

      return modelInfos;
    } catch (error) {
      console.error(`❌ Failed to scan directory ${directory}:`, error.message);
      throw error;
    }
  }

  /**
   * Generate response using LangChain or simulation
   */

  async generate(modelType, prompt, options = {}) {
    try {
      const modelInfo = this.modelPaths.get(modelType);
      if (!modelInfo) {
        throw new Error(`LangChain model '${modelType}' is not available`);
      }

      console.log(`🤖 [LANGCHAIN] Generating with model: ${modelInfo.name}`);

      // Load model if not already loaded
      if (!this.loadedModels.has(modelType)) {
        console.log(`📥 Loading LangChain model: ${modelInfo.path}`);

        const model = new LlamaCpp({
          modelPath: modelInfo.path,
          maxTokens: options.maxTokens || 512,
          temperature: options.temperature || 0.7,
          topP: options.topP || 0.9,
          topK: options.topK || 40,
        });

        this.loadedModels.set(modelType, { model });
        console.log(`✅ LangChain model loaded: ${modelInfo.name}`);
      }

      const { model } = this.loadedModels.get(modelType);

      const startTime = Date.now();

      // FIX: use invoke instead of call
      const response = await model.invoke(prompt);

      const duration = Date.now() - startTime;
      console.log(`✅ [LANGCHAIN] Response generated in ${duration}ms`);

      return response;
    } catch (error) {
      console.error(`❌ [LANGCHAIN] Model generation failed:`, error.message);
      throw new Error(`LangChain model inference failed: ${error.message}`);
    }
  }


  /**
   * Chat interface
   */
  async chat(modelType, messages, options = {}) {
    try {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'user') {
        throw new Error('Invalid message format: expected user message');
      }
      
      return await this.generate(modelType, lastMessage.content, options);
    } catch (error) {
      console.error(`❌ [LANGCHAIN${this.simulationMode ? '-SIMULATION' : ''}] Chat generation failed:`, error.message);
      throw error;
    }
  }

  /**
   * Streaming generation using LangChain or simulation
   */
  async *generateStream(modelType, prompt, options = {}) {
    try {
      const modelInfo = this.modelPaths.get(modelType);
      if (!modelInfo) {
        throw new Error(`LangChain model '${modelType}' is not available for streaming`);
      }

      console.log(`🤖 [LANGCHAIN-STREAM] Streaming with model: ${modelInfo.name}`);

      if (!this.loadedModels.has(modelType)) {
        console.log(`📥 Loading LangChain streaming model: ${modelInfo.path}`);

        const model = new LlamaCpp({
          modelPath: modelInfo.path,
          maxTokens: options.maxTokens || 512,
          temperature: options.temperature || 0.7,
          topP: options.topP || 0.9,
          topK: options.topK || 40,
        });

        this.loadedModels.set(modelType, { model });
        console.log(`✅ LangChain streaming model loaded: ${modelInfo.name}`);
      }

      const { model } = this.loadedModels.get(modelType);

      // FIX: use stream correctly
      const stream = await model.stream(prompt);

      for await (const chunk of stream) {
        yield {
          type: "content",
          content: chunk,
          done: false,
          model: modelInfo.name,
        };
      }

      yield {
        type: "complete",
        content: null,
        done: true,
        model: modelInfo.name,
      };
    } catch (error) {
      console.error(`❌ [LANGCHAIN-STREAM] Streaming failed:`, error.message);
      yield {
        type: "error",
        content: `LangChain streaming error: ${error.message}`,
        error: true,
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
    
    const modelInfo = this.modelPaths.get(modelType);
    if (!modelInfo) return false;
    
    if (this.simulationMode) {
      return true; // Simulation models are always "available"
    }
    
    return await fs.pathExists(modelInfo.path);
  }

  /**
   * List available models
   */
  async listModels() {
    if (!this.isInitialized) {
      throw new Error('Model client not initialized');
    }
    
    const models = [];
    
    for (const [type, modelInfo] of this.modelPaths.entries()) {
      if (modelInfo) {
        const available = this.simulationMode || await fs.pathExists(modelInfo.path);
        if (available) {
          let size = modelInfo.size;
          if (!this.simulationMode && await fs.pathExists(modelInfo.path)) {
            const stats = await fs.stat(modelInfo.path);
            size = stats.size;
          }
          
          models.push({
            name: modelInfo.name,
            type: type,
            size: size,
            path: modelInfo.path,
            status: this.simulationMode ? 'simulation' : 'ready',
            production: !this.simulationMode,
            langchain: true,
            simulation: this.simulationMode
          });
        }
      }
    }
    
    return models;
  }

  /**
   * Check availability
   */
  async isAvailable() {
    if (!this.isInitialized) {
      return false;
    }
    
    if (this.simulationMode) {
      return true; // Simulation mode is always available
    }
    
    const chatAvailable = await this.isModelAvailable('chat');
    const llmAvailable = await this.isModelAvailable('llm');
    
    return chatAvailable || llmAvailable;
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      langchainSupport: langchainAvailable,
      simulationMode: this.simulationMode,
      loadedModels: Array.from(this.loadedModels.keys()),
      availableModels: Array.from(this.modelPaths.keys()),
      productionMode: !this.simulationMode,
      fallbackMode: false
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log(`🧹 [LANGCHAIN${this.simulationMode ? '-SIMULATION' : ''}] Cleaning up model resources...`);
    
    for (const [modelType, model] of this.loadedModels.entries()) {
      try {
        if (model && typeof model.cleanup === 'function') {
          await model.cleanup();
        }
        console.log(`✅ Cleaned up ${this.simulationMode ? 'simulation' : 'LangChain'} model: ${modelType}`);
      } catch (error) {
        console.warn(`⚠️  Failed to cleanup model ${modelType}:`, error.message);
      }
    }
    
    this.loadedModels.clear();
    console.log(`✅ ${this.simulationMode ? 'Simulation' : 'LangChain'} cleanup completed`);
  }
}

// Export LangChain singleton instance
export const langchainModelClient = new LangChainModelClient();