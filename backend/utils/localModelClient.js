import fs from 'fs-extra';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { LlamaModel, LlamaContext, LlamaChatSession } from "node-llama-cpp";

// Try to import node-llama-cpp, fail fast if not available
let LlamaModel, llamaCppAvailable = false;

try {
  const llamaCpp = await import('node-llama-cpp');
  // Handle possible default export
  LlamaModel = llamaCpp.LlamaModel || llamaCpp.default?.LlamaModel || llamaCpp.default;
  if (!LlamaModel) {
    throw new Error('LlamaModel not found in node-llama-cpp package');
  }
  llamaCppAvailable = true;
  console.log('✅ node-llama-cpp loaded successfully');
} catch (error) {
  console.error('❌ node-llama-cpp failed to load:', error.message);
  console.error('💡 This system requires native model support. Please ensure node-llama-cpp is properly installed.');
  llamaCppAvailable = false;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Production Local GGUF Model Client
 * Only works with real model inference - no fallback responses
 */
class LocalModelClient {
  constructor() {
    this.loadedModels = new Map();
    this.modelPaths = new Map();
    this.isInitialized = false;
    
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
   * Initialize and ensure models are available for production use
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        return { success: true, message: 'Already initialized' };
      }

      console.log('🚀 Initializing Production GGUF Model Client...');
      
      // Strict requirement: node-llama-cpp must be available
      if (!llamaCppAvailable) {
        throw new Error('Production system requires node-llama-cpp. Please install and configure the native dependencies.');
      }

      console.log('✅ Native model support confirmed');
      
      // Ensure model directories exist
      const chatDir = path.resolve('./models/chat/');
      const llmDir = path.resolve('./models/llm/');
      
      await fs.ensureDir(chatDir);
      await fs.ensureDir(llmDir);
      
      // Scan for existing models
      const chatModels = await this.scanModelDirectory(chatDir);
      const llmModels = await this.scanModelDirectory(llmDir);
      
      console.log(`📁 Found ${chatModels.length} chat models and ${llmModels.length} LLM models`);
      
      // Ensure models are available - download if necessary
      await this.ensureModelAvailable('chat', chatModels, chatDir);
      await this.ensureModelAvailable('llm', llmModels, llmDir);
      
      // Validate that models can be loaded
      await this.validateModelIntegrity();
      
      this.isInitialized = true;
      console.log('🎉 Production model client initialized successfully');
      
      return {
        success: true,
        chatModel: this.modelPaths.get('chat'),
        llmModel: this.modelPaths.get('llm'),
        productionMode: true,
        nativeSupport: true
      };
    } catch (error) {
      console.error('❌ Failed to initialize production model client:', error.message);
      this.isInitialized = false;
      throw error; // Fail fast in production
    }
  }

  /**
   * Validate model integrity before marking as initialized
   */
  async validateModelIntegrity() {
    console.log('🔍 Validating model integrity...');
    
    for (const [modelType, modelInfo] of this.modelPaths.entries()) {
      if (!modelInfo || !await fs.pathExists(modelInfo.path)) {
        throw new Error(`Model ${modelType} is not available at path: ${modelInfo?.path || 'unknown'}`);
      }
      
      const stats = await fs.stat(modelInfo.path);
      if (stats.size < 10 * 1024 * 1024) { // Less than 10MB is likely corrupted
        throw new Error(`Model ${modelType} appears to be corrupted (size: ${stats.size} bytes)`);
      }
      
      console.log(`✅ Model ${modelType} validated: ${modelInfo.name} (${Math.round(stats.size / (1024 * 1024))}MB)`);
    }
  }

  /**
   * Ensure a model is available for production use
   */
  async ensureModelAvailable(modelType, existingModels, directory) {
    if (existingModels.length > 0) {
      // Use existing model
      const selectedModel = existingModels[0];
      this.modelPaths.set(modelType, selectedModel);
      console.log(`✅ Using existing ${modelType} model: ${selectedModel.name}`);
      return selectedModel;
    }

    // Download recommended model for production
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
   * Download model with production-grade error handling
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
        // Handle redirects
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
          
          // Progress reporting every 5 seconds
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
      
      // Production timeout: 10 minutes for large models
      request.setTimeout(600000, () => {
        request.destroy();
        file.destroy();
        fs.unlink(filepath).catch(() => {});
        reject(new Error('Download timeout - production models require stable connection'));
      });
    });
  }

  /**
   * Scan directory for production model files
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
      
      // Filter for valid model files
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
          
          // Production requirement: models must be substantial
          if (stats.size > 50 * 1024 * 1024) { // Minimum 50MB
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
   * Check if a model is available for production use
   */
  async isModelAvailable(modelType) {
    if (!this.isInitialized) {
      return false;
    }
    
    const modelInfo = this.modelPaths.get(modelType);
    if (!modelInfo) return false;
    
    return await fs.pathExists(modelInfo.path);
  }

  /**
   * Generate response using production model inference
   */
  async generate(modelType, prompt, options = {}) {
    try {
      // Strict production validation
      if (!this.isInitialized) {
        throw new Error('Model client not initialized. Call initialize() first.');
      }

      if (!llamaCppAvailable) {
        throw new Error('Production system requires native model support. Please ensure node-llama-cpp is properly installed.');
      }

      const modelInfo = this.modelPaths.get(modelType);
      if (!modelInfo) {
        throw new Error(`Production model '${modelType}' is not available`);
      }

      console.log(`🤖 [PRODUCTION] Generating with model: ${modelInfo.name}`);
      
      // Load model if not already loaded
      if (!this.loadedModels.has(modelType)) {
        console.log(`📥 Loading production model: ${modelInfo.path}`);
        
        const model = new LlamaModel({
          model: modelInfo.path,
          n_ctx: options.contextSize || 2048,
          n_threads: options.threads || 4,
          n_gpu_layers: options.gpuLayers || 0 // CPU-first for stability
        });
        
        this.loadedModels.set(modelType, { model });
        console.log(`✅ Production model loaded: ${modelInfo.name}`);
      }
      
      const { model } = this.loadedModels.get(modelType);
      
      // Production inference
      console.log(`💭 [PRODUCTION] Processing: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}"`);
      
      const startTime = Date.now();
      const response = await model.predict(prompt, {
        n_predict: options.maxTokens || 512,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
        top_k: options.topK || 40,
        repeat_penalty: options.repeatPenalty || 1.1
      });
      
      const duration = Date.now() - startTime;
      const tokensPerSecond = response.length / (duration / 1000);
      
      console.log(`✅ [PRODUCTION] Response generated: ${response.length} chars in ${duration}ms (${tokensPerSecond.toFixed(1)} chars/sec)`);
      
      return response;
      
    } catch (error) {
      console.error(`❌ [PRODUCTION] Model generation failed:`, error.message);
      throw new Error(`Production model inference failed: ${error.message}`);
    }
  }

  /**
   * Production chat interface
   */
  async chat(modelType, messages, options = {}) {
    try {
      // Convert messages to prompt format for production
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'user') {
        throw new Error('Invalid message format: expected user message');
      }
      
      return await this.generate(modelType, lastMessage.content, options);
    } catch (error) {
      console.error(`❌ [PRODUCTION] Chat generation failed:`, error.message);
      throw error;
    }
  }

  /**
   * Production streaming generation
   */


async* generateStream(modelType, prompt, options = {}) {
  try {
    if (!this.isInitialized || !llamaCppAvailable) {
      throw new Error("Production streaming requires initialized native model support");
    }

    const modelInfo = this.modelPaths.get(modelType);
    if (!modelInfo) {
      throw new Error(`Production model '${modelType}' is not available for streaming`);
    }

    console.log(`📥 Loading model for production streaming: ${modelInfo.path}`);

    if (!this.loadedModels.has(modelType)) {
      // 1. Load model
      const model = new LlamaModel({
        modelPath: modelInfo.path,
      });

      // 2. Create context
      const context = new LlamaContext({ model, contextSize: options.contextSize || 2048 });

      // 3. Create chat/session handler
      const session = new LlamaChatSession({ context });

      this.loadedModels.set(modelType, { model, context, session });
      console.log(`✅ Production streaming model loaded: ${modelInfo.name}`);
    }

    const { session } = this.loadedModels.get(modelType);

    console.log(`🤖 [PRODUCTION] Streaming with model: ${modelInfo.name}`);

    const startTime = Date.now();

    // 4. Get response
    const response = await session.prompt(prompt, {
      maxTokens: options.maxTokens || 512,
      temperature: options.temperature || 0.7,
      topP: options.topP || 0.9,
      topK: options.topK || 40,
    });

    const duration = Date.now() - startTime;
    console.log(`✅ [PRODUCTION STREAM] Response generated in ${duration}ms`);

    // Stream chunked response
    const chunkSize = 10;
    for (let i = 0; i < response.length; i += chunkSize) {
      yield {
        type: "content",
        content: response.slice(i, i + chunkSize),
        done: false,
        model: modelInfo.name,
      };
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    yield {
      type: "complete",
      content: response,
      done: true,
      model: modelInfo.name,
    };
  } catch (error) {
    console.error(`❌ [PRODUCTION] Streaming failed:`, error.message);
    yield {
      type: "error",
      content: `Production streaming error: ${error.message}`,
      error: true,
    };
  }
}
  /**
   * Production cleanup - free memory resources
   */
  async cleanup() {
    console.log('🧹 [PRODUCTION] Cleaning up model resources...');
    
    for (const [modelType, { model }] of this.loadedModels.entries()) {
      try {
        if (model && typeof model.dispose === 'function') {
          await model.dispose();
        }
        console.log(`✅ Cleaned up production model: ${modelType}`);
      } catch (error) {
        console.warn(`⚠️  Failed to cleanup model ${modelType}:`, error.message);
      }
    }
    
    this.loadedModels.clear();
    console.log('✅ Production cleanup completed');
  }

  /**
   * List available production models
   */
  async listModels() {
    if (!this.isInitialized) {
      throw new Error('Model client not initialized');
    }
    
    const models = [];
    
    for (const [type, modelInfo] of this.modelPaths.entries()) {
      if (modelInfo && await fs.pathExists(modelInfo.path)) {
        const stats = await fs.stat(modelInfo.path);
        models.push({
          name: modelInfo.name,
          type: type,
          size: stats.size,
          path: modelInfo.path,
          status: 'ready',
          production: true
        });
      }
    }
    
    return models;
  }

  /**
   * Check production model availability
   */
  async isAvailable() {
    if (!this.isInitialized || !llamaCppAvailable) {
      return false;
    }
    
    const chatAvailable = await this.isModelAvailable('chat');
    const llmAvailable = await this.isModelAvailable('llm');
    
    return chatAvailable || llmAvailable;
  }

  /**
   * Get production system status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      nativeSupport: llamaCppAvailable,
      loadedModels: Array.from(this.loadedModels.keys()),
      availableModels: Array.from(this.modelPaths.keys()),
      productionMode: true,
      fallbackMode: false
    };
  }
}

// Export production singleton instance
export const localModelClient = new LocalModelClient();