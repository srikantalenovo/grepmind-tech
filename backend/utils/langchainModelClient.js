// LangChainModelClient.js
import fs from 'fs-extra';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

// ------------------------------------------------------------
// Try to import LangChain components with graceful fallback
// ------------------------------------------------------------
let ChatLlamaCpp, LlamaCpp, langchainAvailable = false;

try {
  // Dynamically import LangChain LlamaCpp integrations
  const langchainCommunity = await import('@langchain/community/chat_models/llama_cpp');
  const langchainLlms = await import('@langchain/community/llms/llama_cpp');

  ChatLlamaCpp = langchainCommunity.ChatLlamaCpp;
  LlamaCpp = langchainLlms.LlamaCpp;
  langchainAvailable = true;

  console.log('✅ LangChain LlamaCpp loaded successfully');
} catch (error) {
  console.log('⚠️  LangChain not available, running in simulation mode');
  console.log('💡 To enable full LangChain support, install: npm install langchain @langchain/core @langchain/community');
  langchainAvailable = false;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Production LangChain GGUF Model Client
 * - Uses LangChain abstractions for real model inference
 * - Falls back to simulation mode if dependencies are not available
 */
class LangChainModelClient {
  constructor() {
    this.loadedModels = new Map();
    this.modelPaths = new Map();
    this.isInitialized = false;
    this.simulationMode = !langchainAvailable;

    // Predefined production models
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

  // ----------------------------------------------------------------
  // Initialization
  // ----------------------------------------------------------------
  async initialize() {
    if (this.isInitialized) {
      return { success: true, message: 'Already initialized' };
    }

    console.log('🚀 Initializing LangChain GGUF Model Client...');
    if (this.simulationMode) {
      console.log('🔧 Running in simulation mode');
    }

    // Ensure model directories
    const chatDir = path.resolve('./models/chat/');
    const llmDir = path.resolve('./models/llm/');
    await fs.ensureDir(chatDir);
    await fs.ensureDir(llmDir);

    // Scan for existing models
    const chatModels = await this.scanModelDirectory(chatDir);
    const llmModels = await this.scanModelDirectory(llmDir);

    console.log(`📁 Found ${chatModels.length} chat models, ${llmModels.length} LLM models`);

    if (!this.simulationMode) {
      await this.ensureModelAvailable('chat', chatModels, chatDir);
      await this.ensureModelAvailable('llm', llmModels, llmDir);
      await this.validateModelIntegrity();
    } else {
      // Configure simulation models
      this.modelPaths.set('chat', { name: 'simulation-chat', path: './simulation/chat.gguf', size: 0 });
      this.modelPaths.set('llm', { name: 'simulation-llm', path: './simulation/llm.gguf', size: 0 });
    }

    this.isInitialized = true;
    console.log('🎉 LangChain model client initialized');

    return {
      success: true,
      simulationMode: this.simulationMode,
      langchainSupport: langchainAvailable
    };
  }

  // ----------------------------------------------------------------
  // Model validation
  // ----------------------------------------------------------------
  async validateModelIntegrity() {
    if (this.simulationMode) return;

    for (const [modelType, modelInfo] of this.modelPaths.entries()) {
      if (!await fs.pathExists(modelInfo.path)) {
        throw new Error(`Missing model: ${modelType}`);
      }
      const stats = await fs.stat(modelInfo.path);
      if (stats.size < 10 * 1024 * 1024) {
        throw new Error(`Corrupted model: ${modelType}`);
      }
      console.log(`✅ Model validated: ${modelInfo.name}`);
    }
  }

  // ----------------------------------------------------------------
  // Ensure model available or download
  // ----------------------------------------------------------------
  async ensureModelAvailable(modelType, existingModels, directory) {
    if (existingModels.length > 0) {
      const model = existingModels[0];
      this.modelPaths.set(modelType, model);
      return model;
    }

    const modelConfig = this.availableModels[modelType];
    const downloadPath = path.join(directory, modelConfig.fileName);

    await this.downloadModel(modelConfig.url, downloadPath, modelConfig.size);

    const stats = await fs.stat(downloadPath);
    const downloadedModel = { name: modelConfig.fileName, path: downloadPath, size: stats.size };
    this.modelPaths.set(modelType, downloadedModel);
    return downloadedModel;
  }

  // ----------------------------------------------------------------
  // Download model
  // ----------------------------------------------------------------
  async downloadModel(url, filepath, expectedSize) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filepath);
      let downloaded = 0;

      const req = https.get(url, (res) => {
        if (res.statusCode !== 200) {
          file.destroy();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.on('data', (chunk) => {
          downloaded += chunk.length;
          file.write(chunk);
        });
        res.on('end', () => {
          file.end();
          console.log(`✅ Downloaded ${filepath} (${downloaded} bytes)`);
          resolve();
        });
      });

      req.on('error', reject);
    });
  }

  // ----------------------------------------------------------------
  // Scan models
  // ----------------------------------------------------------------
  async scanModelDirectory(directory) {
    const files = (await fs.readdir(directory)).filter(f => f.endsWith('.gguf'));
    const infos = [];
    for (const f of files) {
      const stats = await fs.stat(path.join(directory, f));
      if (stats.size > 50 * 1024 * 1024) {
        infos.push({ name: f, path: path.join(directory, f), size: stats.size });
      }
    }
    return infos;
  }

  // ----------------------------------------------------------------
  // Generate text (single-shot)
  // ----------------------------------------------------------------
  async generate(modelType, prompt, options = {}) {
    const modelInfo = this.modelPaths.get(modelType);
    if (!modelInfo) throw new Error(`Model not found: ${modelType}`);

    if (!this.loadedModels.has(modelType)) {
      let model;
      if (!this.simulationMode && langchainAvailable) {
        model = new LlamaCpp({
          modelPath: modelInfo.path,
          temperature: options.temperature || 0.7,
          maxTokens: options.maxTokens || 256
        });
      } else {
        model = {
          call: async () => `[SIMULATION] Pretend response to "${prompt.slice(0, 50)}..."`
        };
      }
      this.loadedModels.set(modelType, model);
    }

    const model = this.loadedModels.get(modelType);
    return model.call(prompt);
  }

  // ----------------------------------------------------------------
  // Chat wrapper
  // ----------------------------------------------------------------
  async chat(modelType, messages, options = {}) {
    const last = messages[messages.length - 1];
    return this.generate(modelType, last.content, options);
  }

  // ----------------------------------------------------------------
  // Streaming generation (simulated if no real LangChain stream)
  // ----------------------------------------------------------------
  async* generateStream(modelType, prompt, options = {}) {
    const full = await this.generate(modelType, prompt, options);
    for (let i = 0; i < full.length; i += 15) {
      yield { type: 'content', content: full.slice(i, i + 15), done: false };
      await new Promise(r => setTimeout(r, 80));
    }
    yield { type: 'complete', done: true };
  }

  // ----------------------------------------------------------------
  // Utility
  // ----------------------------------------------------------------
  getStatus() {
    return {
      initialized: this.isInitialized,
      langchainSupport: langchainAvailable,
      simulationMode: this.simulationMode,
      loadedModels: Array.from(this.loadedModels.keys())
    };
  }

  async cleanup() {
    this.loadedModels.clear();
  }
}

// ------------------------------------------------------------
// Export singleton
// ------------------------------------------------------------
export const langchainModelClient = new LangChainModelClient();
export default langchainModelClient;