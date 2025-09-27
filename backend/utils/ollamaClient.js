import axios from 'axios';

/**
 * Ollama HTTP Client
 * Handles communication with Ollama API
 */
class OllamaClient {
  constructor(baseURL = 'http://localhost:11434') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 600000, // 60 second timeout for AI responses
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Check if Ollama is running and accessible
   */
  async isAvailable() {
    try {
      const response = await this.client.get('/api/tags');
      return response.status === 200;
    } catch (error) {
      console.error('Ollama is not available:', error.message);
      return false;
    }
  }

  /**
   * List available models in Ollama
   */
  async listModels() {
    try {
      const response = await this.client.get('/api/tags');
      return response.data.models || [];
    } catch (error) {
      console.error('Failed to list Ollama models:', error.message);
      return [];
    }
  }

  /**
   * Check if a specific model exists in Ollama
   */
  async modelExists(modelName) {
    try {
      const models = await this.listModels();
      return models.some(model => model.name === modelName || model.name.includes(modelName));
    } catch (error) {
      console.error('Failed to check model existence:', error.message);
      return false;
    }
  }

  /**
   * Generate text using Ollama model
   */
  async generate(modelName, prompt, options = {}) {
    try {
      const requestBody = {
        model: modelName,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          top_p: options.topP || 0.9,
          top_k: options.topK || 40,
          num_predict: options.maxTokens || 2048,
          stop: options.stopSequences || []
        }
      };

      console.log(`🤖 Generating response with model: ${modelName}`);
      const response = await this.client.post('/api/generate', requestBody);
      
      if (response.data && response.data.response) {
        return {
          success: true,
          response: response.data.response,
          model: modelName,
          done: response.data.done,
          context: response.data.context,
          total_duration: response.data.total_duration,
          eval_count: response.data.eval_count
        };
      } else {
        throw new Error('Invalid response from Ollama');
      }
    } catch (error) {
      console.error(`Failed to generate with model ${modelName}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate streaming response
   */
  async* generateStream(modelName, prompt, options = {}) {
    try {
      const requestBody = {
        model: modelName,
        prompt: prompt,
        stream: true,
        options: {
          temperature: options.temperature || 0.7,
          top_p: options.topP || 0.9,
          top_k: options.topK || 40,
          num_predict: options.maxTokens || 2048,
          stop: options.stopSequences || []
        }
      };

      const response = await this.client.post('/api/generate', requestBody, {
        responseType: 'stream'
      });

      let buffer = '';
      
      for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                yield {
                  type: 'content',
                  content: data.response,
                  done: data.done
                };
              }
              if (data.done) {
                return;
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming response:', line);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to stream with model ${modelName}:`, error.message);
      yield {
        type: 'error',
        content: error.message
      };
    }
  }

  /**
   * Chat with a model (for conversational models)
   */
  async chat(modelName, messages, options = {}) {
    try {
      const requestBody = {
        model: modelName,
        messages: messages,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          top_p: options.topP || 0.9,
          top_k: options.topK || 40,
          num_predict: options.maxTokens || 2048
        }
      };

      console.log(`💬 Chatting with model: ${modelName}`);
      const response = await this.client.post('/api/chat', requestBody);
      
      if (response.data && response.data.message) {
        return {
          success: true,
          message: response.data.message,
          model: modelName,
          done: response.data.done,
          total_duration: response.data.total_duration,
          eval_count: response.data.eval_count
        };
      } else {
        throw new Error('Invalid chat response from Ollama');
      }
    } catch (error) {
      console.error(`Failed to chat with model ${modelName}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName) {
    try {
      console.log(`📥 Pulling model: ${modelName}`);
      const response = await this.client.post('/api/pull', {
        name: modelName,
        stream: false
      });

      return {
        success: true,
        model: modelName,
        status: response.data.status
      };
    } catch (error) {
      console.error(`Failed to pull model ${modelName}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get model information
   */
  async showModel(modelName) {
    try {
      const response = await this.client.post('/api/show', {
        name: modelName
      });

      return {
        success: true,
        model: response.data
      };
    } catch (error) {
      console.error(`Failed to get model info for ${modelName}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const ollamaClient = new OllamaClient();

// Export class for custom instances
export { OllamaClient };