import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';

/**
 * Local GGUF Model Client
 * Directly uses local GGUF model files without requiring Ollama
 */
class LocalModelClient {
  constructor() {
    this.activeProcesses = new Map();
    this.modelPaths = new Map();
  }

  /**
   * Initialize and detect available local models
   */
  async initialize() {
    try {
      console.log('🔍 Scanning for local model files...');
      
      // Scan chat models directory
      const chatDir = path.resolve('../models/chat/');
      const llmDir = path.resolve('../models/llm/');
      
      const chatModels = await this.scanModelDirectory(chatDir);
      const llmModels = await this.scanModelDirectory(llmDir);
      
      console.log(`📁 Found ${chatModels.length} chat models and ${llmModels.length} LLM models`);
      
      // Map model types to available files
      this.modelPaths.set('chat', chatModels[0] || null); // Use first available chat model
      this.modelPaths.set('llm', llmModels[0] || null);   // Use first available LLM model
      
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
   * Generate response using local model
   * NOTE: This requires a proper GGUF inference engine to work with actual model files
   */
  async generate(modelType, prompt, options = {}) {
    try {
      const modelInfo = this.modelPaths.get(modelType);
      if (!modelInfo) {
        throw new Error(`No ${modelType} model available`);
      }

      console.log(`🤖 Attempting to generate with local model: ${modelInfo.name}`);
      
      // TODO: Implement actual GGUF model inference
      // This requires integrating with a GGUF inference engine like:
      // - llama.cpp Node.js bindings
      // - Transformers.js for browser-compatible inference
      // - ONNX Runtime for cross-platform inference
      // - Or calling external inference server
      
      throw new Error(`Local model inference not implemented yet. Model file detected: ${modelInfo.name} (${Math.round(modelInfo.size / (1024*1024))}MB), but requires GGUF inference engine integration.`);
      
    } catch (error) {
      console.error(`Local model generation failed:`, error.message);
      throw error;
    }
  }

  /**
   * Chat method for conversational models
   */
  async chat(modelType, messages, options = {}) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'user') {
      return this.generate(modelType, lastMessage.content, options);
    }
    throw new Error('No user message found in conversation');
  }

  /**
   * Stream generation (simulated) 
   */
  async* generateStream(modelType, prompt, options = {}) {
    try {
      // Since we don't have real inference yet, throw the same error as generate()
      const response = await this.generate(modelType, prompt, options);
      
      // This code won't be reached until real inference is implemented
      const sentences = response.split(/(?<=[.!?])\s+/);
      let currentText = '';
      
      for (let i = 0; i < sentences.length; i++) {
        currentText += sentences[i] + (i < sentences.length - 1 ? ' ' : '');
        yield {
          type: 'content',
          content: currentText,
          done: i === sentences.length - 1
        };
        
        // Small delay for streaming effect
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      yield {
        type: 'error',
        content: error.message
      };
    }
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