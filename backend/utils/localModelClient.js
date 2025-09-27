// backend/services/localModelClient.js
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { LlamaModel, LlamaContext, LlamaChatSession } from 'node-llama-cpp';

// Needed for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LocalModelClient {
  constructor() {
    this.modelPaths = new Map();   // Holds discovered model files
    this.sessions = new Map();     // Holds active LlamaChatSession instances
  }

  /**
   * Initialize local models by scanning model directories and loading them.
   */
  async initialize() {
    console.log('🔍 Scanning for local GGUF model files...');

    const chatDir = path.resolve(__dirname, '../../models/chat/');
    const llmDir = path.resolve(__dirname, '../../models/llm/');

    const chatModels = await this.scanModelDirectory(chatDir);
    const llmModels = await this.scanModelDirectory(llmDir);

    this.modelPaths.set('chat', chatModels[0] || null);
    this.modelPaths.set('llm', llmModels[0] || null);

    // Auto-load available models
    for (const [type, modelInfo] of this.modelPaths.entries()) {
      if (modelInfo) {
        await this.loadModel(type, modelInfo.path);
      } else {
        console.warn(`⚠️ No local ${type} model found`);
      }
    }

    return {
      chatModel: this.modelPaths.get('chat'),
      llmModel: this.modelPaths.get('llm'),
    };
  }

  /**
   * Scan a directory for GGUF model files.
   */
  async scanModelDirectory(dir) {
    try {
      if (!(await fs.pathExists(dir))) {
        console.warn(`⚠️ Directory not found: ${dir}`);
        return [];
      }

      const files = await fs.readdir(dir);
      const models = files
        .filter(file => file.endsWith('.gguf'))
        .map(file => ({
          name: file,
          path: path.resolve(dir, file),
        }));

      if (models.length > 0) {
        console.log(`✅ Found ${models.length} GGUF model(s) in ${dir}`);
      }

      return models;
    } catch (err) {
      console.error(`❌ Error scanning directory ${dir}:`, err);
      return [];
    }
  }

  /**
   * Load a GGUF model into memory and prepare a chat session.
   */
  async loadModel(modelType, modelPath) {
    try {
      console.log(`⚡ Loading GGUF model for ${modelType}: ${modelPath}`);

      const model = new LlamaModel({
        modelPath,
        gpuLayers: 0, // CPU-only inference; change if GPU available
      });

      const context = new LlamaContext({ model });
      const session = new LlamaChatSession({ context });

      this.sessions.set(modelType, session);
      console.log(`✅ ${modelType} model ready`);
    } catch (err) {
      console.error(`❌ Failed to load ${modelType} model:`, err);
      this.sessions.delete(modelType);
    }
  }

  /**
   * Generate text using the specified model type.
   */
  async generate(modelType, prompt) {
    const session = this.sessions.get(modelType);
    if (!session) {
      throw new Error(`No active session for model type: ${modelType}`);
    }

    console.log(`🤖 Running local inference on ${modelType}...`);
    const response = await session.prompt(prompt);
    return response;
  }

  /**
   * Chat interface: expects OpenAI-style messages array.
   */
  async chat(modelType, messages) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'user') {
      return this.generate(modelType, lastMessage.content);
    }
    throw new Error('No user message found in conversation');
  }
}

export const localModelClient = new LocalModelClient();
