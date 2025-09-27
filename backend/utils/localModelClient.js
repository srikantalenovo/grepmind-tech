import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { LlamaModel, LlamaContext, LlamaChatSession } from 'node-llama-cpp';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Local GGUF Model Client
 * Uses node-llama-cpp for real GGUF model inference with automatic downloading
 */
class LocalModelClient {
  constructor() {
    this.loadedModels = new Map();
    this.modelPaths = new Map();
    this.isInitialized = false;
    
    // Recommended models with download URLs
    this.availableModels = {
      chat: {
        name: 'tinyllama-1.1b-chat',
        fileName: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
        url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
        size: '669MB',
        description: 'TinyLlama 1.1B - Fast and efficient chat model, loads in ~30 seconds'
      },
      llm: {
        name: 'llama-3.2-3b-instruct',
        fileName: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        size: '1.9GB',
        description: 'Meta Llama 3.2 3B - Great for general text generation'
      }
    };
  }

  /**
   * Initialize and detect available local models or download them
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        return { success: true, message: 'Already initialized' };
      }

      console.log('🔍 Initializing local GGUF model client...');
      console.log('✅ node-llama-cpp v2.8.0 loaded successfully');
      
      // Scan for existing models first
      const chatDir = path.resolve('./models/chat/');
      const llmDir = path.resolve('./models/llm/');
      
      await fs.ensureDir(chatDir);
      await fs.ensureDir(llmDir);
      
      const chatModels = await this.scanModelDirectory(chatDir);
      const llmModels = await this.scanModelDirectory(llmDir);
      
      console.log(`📁 Found ${chatModels.length} chat models and ${llmModels.length} LLM models`);
      
      // Use existing models or download recommended ones
      await this.ensureModelAvailable('chat', chatModels, chatDir);
      await this.ensureModelAvailable('llm', llmModels, llmDir);
      
      this.isInitialized = true;
      return {
        success: true,
        chatModel: this.modelPaths.get('chat'),
        llmModel: this.modelPaths.get('llm')
      };
    } catch (error) {
      console.error('Failed to initialize local models:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Ensure a model is available, use existing or download recommended one
   */
  async ensureModelAvailable(modelType, existingModels, directory) {
    if (existingModels.length > 0) {
      // Use existing model
      const selectedModel = existingModels[0];
      this.modelPaths.set(modelType, selectedModel);
      console.log(`✅ Using existing ${modelType} model: ${selectedModel.name}`);
      return selectedModel;
    }

    // No existing models, download recommended one
    console.log(`📥 No ${modelType} models found. Downloading recommended model...`);
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
      console.log(`✅ Downloaded and configured ${modelType} model: ${modelConfig.fileName}`);
      return downloadedModel;
    } catch (error) {
      console.error(`❌ Failed to download ${modelType} model:`, error.message);
      throw error;
    }
  }

  /**
   * Download a model from URL with progress
   */
  async downloadModel(url, filepath, expectedSize) {
    return new Promise((resolve, reject) => {
      console.log(`🌐 Downloading model from: ${url}`);
      console.log(`💾 Saving to: ${filepath}`);
      console.log(`📊 Expected size: ${expectedSize}`);
      
      const file = fs.createWriteStream(filepath);
      let downloadedBytes = 0;
      let lastProgressTime = Date.now();
      
      const request = https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          return this.downloadModel(response.headers.location, filepath, expectedSize)
            .then(resolve)
            .catch(reject);
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        const totalSize = parseInt(response.headers['content-length']) || 0;
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          file.write(chunk);
          
          // Progress update every 5 seconds
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
          fs.unlink(filepath).catch(() => {}); // Clean up partial file
          reject(err);
        });
      });
      
      request.on('error', (err) => {
        file.destroy();
        fs.unlink(filepath).catch(() => {}); // Clean up partial file
        reject(err);
      });
      
      request.setTimeout(300000, () => { // 5 minute timeout
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });
  }

  /**
   * Scan directory for model files (including GGUF and other formats)
   */
  async scanModelDirectory(directory) {
    try {
      if (!(await fs.pathExists(directory))) {
        console.log(`📂 Directory does not exist: ${directory}`);
        return [];
      }

      const files = await fs.readdir(directory);
      console.log(`📋 Files in ${directory}:`, files);
      
      // Look for various model file types and naming patterns
      const modelFiles = files.filter(file => {
        // Remove README files
        if (file.toLowerCase().includes('readme')) return false;
        
        // Look for common model file patterns
        return (
          file.endsWith('.gguf') ||           // Standard GGUF format
          file.includes('llama') ||           // Llama models
          file.includes('phi3') ||            // Phi-3 models  
          file.includes('qwen') ||            // Qwen models
          file.includes('mistral') ||         // Mistral models
          file.includes('tinyllama') ||       // TinyLlama models
          file.includes(':') ||               // Ollama-style names like "phi3:mini"
          (file.length > 100000000)          // Large files (likely models)
        );
      });

      const modelInfos = [];
      for (const file of modelFiles) {
        try {
          const filePath = path.join(directory, file);
          const stats = await fs.stat(filePath);
          
          // Only include files larger than 10MB (likely model files)
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

      console.log(`✅ Found ${modelInfos.length} potential model files in ${directory}`);
      modelInfos.forEach(model => {
        const sizeMB = Math.round(model.size / (1024 * 1024));
        console.log(`  📄 ${model.name} (${sizeMB}MB)`);
      });

      return modelInfos;
    } catch (error) {
      console.warn(`Failed to scan directory ${directory}:`, error.message);
      return [];
    }
  }

  /**
   * Check if a model is available locally
   */
  async isModelAvailable(modelType) {
    const modelInfo = this.modelPaths.get(modelType);
    if (!modelInfo) return false;
    
    return await fs.pathExists(modelInfo.path);
  }

  /**
   * Generate response using local GGUF model with real inference
   */
  async generate(modelType, prompt, options = {}) {
    try {
      const modelInfo = this.modelPaths.get(modelType);
      if (!modelInfo) {
        throw new Error(`No ${modelType} model available`);
      }

      console.log(`🤖 Generating with local model: ${modelInfo.name}`);
      
      // Load model if not already loaded
      if (!this.loadedModels.has(modelType)) {
        console.log(`📥 Loading model: ${modelInfo.path}`);
        const model = new LlamaModel({
          modelPath: modelInfo.path,
          gpuLayers: 0 // Use CPU only for broader compatibility
        });
        
        const context = new LlamaContext({
          model: model,
          contextSize: options.contextSize || 4096
        });
        
        const session = new LlamaChatSession({
          context: context
        });
        
        this.loadedModels.set(modelType, { model, context, session });
        console.log(`✅ Model loaded successfully: ${modelInfo.name}`);
      }
      
      const { session } = this.loadedModels.get(modelType);
      
      // Generate response
      console.log(`💭 Generating response for: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}"`);
      
      const response = await session.prompt(prompt, {
        maxTokens: options.maxTokens || 512,
        temperature: options.temperature || 0.7,
        topP: options.topP || 0.9,
        topK: options.topK || 40
      });
      
      console.log(`✅ Generated response (${response.length} chars)`);
      return response;
      
    } catch (error) {
      console.error(`Local model generation failed:`, error.message);
      throw error;
    }
  }

  /**
   * Chat method for conversational models with message history
   */
  async chat(modelType, messages, options = {}) {
    try {
      // Convert messages to a single prompt for now
      // In future versions, we can implement proper conversation handling
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'user') {
        return this.generate(modelType, lastMessage.content, options);
      }
      throw new Error('No user message found in conversation');
    } catch (error) {
      console.error(`Chat generation failed:`, error.message);
      throw error;
    }
  }

  /**
   * Stream generation with real inference
   */
  async* generateStream(modelType, prompt, options = {}) {
    try {
      const modelInfo = this.modelPaths.get(modelType);
      if (!modelInfo) {
        throw new Error(`No ${modelType} model available`);
      }

      console.log(`🤖 Streaming with local model: ${modelInfo.name}`);
      
      // Load model if not already loaded
      if (!this.loadedModels.has(modelType)) {
        console.log(`📥 Loading model for streaming: ${modelInfo.path}`);
        const model = new LlamaModel({
          modelPath: modelInfo.path,
          gpuLayers: 0
        });
        
        const context = new LlamaContext({
          model: model,
          contextSize: options.contextSize || 4096
        });
        
        const session = new LlamaChatSession({
          context: context
        });
        
        this.loadedModels.set(modelType, { model, context, session });
        console.log(`✅ Model loaded for streaming: ${modelInfo.name}`);
      }
      
      const { session } = this.loadedModels.get(modelType);
      
      // Stream response
      let fullResponse = '';
      for await (const chunk of session.promptWithMeta(prompt, {
        maxTokens: options.maxTokens || 512,
        temperature: options.temperature || 0.7,
        topP: options.topP || 0.9,
        topK: options.topK || 40,
        onToken: (chunk) => {
          fullResponse += chunk;
          return chunk;
        }
      })) {
        yield {
          type: 'content',
          content: chunk,
          done: false
        };
      }
      
      yield {
        type: 'content',
        content: fullResponse,
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
   * Cleanup loaded models to free memory
   */
  async cleanup() {
    for (const [modelType, { context }] of this.loadedModels.entries()) {
      try {
        await context.dispose();
        console.log(`🧹 Cleaned up model: ${modelType}`);
      } catch (error) {
        console.warn(`Failed to cleanup model ${modelType}:`, error.message);
      }
    }
    this.loadedModels.clear();
  }

  /**
   * List local models
   */
  async listModels() {
    const models = [];
    
    for (const [type, modelInfo] of this.modelPaths.entries()) {
      if (modelInfo) {
        models.push({
          name: modelInfo.name,
          type: type,
          size: modelInfo.size || 0,
          path: modelInfo.path
        });
      }
    }
    
    return models;
  }

  /**
   * Check if local models are available
   */
  async isAvailable() {
    const chatAvailable = await this.isModelAvailable('chat');
    const llmAvailable = await this.isModelAvailable('llm');
    return chatAvailable || llmAvailable;
  }
}

// Export singleton instance
export const localModelClient = new LocalModelClient();