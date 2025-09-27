// API base URL - adjust for your environment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class AIApiService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/ai`;
    this.abortControllers = new Map(); // Track ongoing requests
  }

  /**
   * Make HTTP request with error handling
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      ...options,
    };

    try {
      const response = await fetch(url, defaultOptions);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  /**
   * Cancel ongoing request
   */
  cancelRequest(requestId) {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // =================== INITIALIZATION & STATUS ===================

  /**
   * Initialize AI services
   */
  async initializeServices() {
    return await this.makeRequest('/initialize', {
      method: 'POST',
    });
  }

  /**
   * Get AI services status
   */
  async getStatus() {
    return await this.makeRequest('/status');
  }

  /**
   * Health check
   */
  async healthCheck() {
    return await this.makeRequest('/health');
  }

  // =================== CHAT FUNCTIONALITY ===================

  /**
   * Send chat message
   */
  async sendChatMessage(sessionId, message, options = {}) {
    const requestId = this.generateRequestId();
    
    try {
      const controller = new AbortController();
      this.abortControllers.set(requestId, controller);

      const response = await this.makeRequest('/chat', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          sessionId,
          message,
          options
        }),
      });

      this.abortControllers.delete(requestId);
      return { ...response, requestId };
    } catch (error) {
      this.abortControllers.delete(requestId);
      throw error;
    }
  }

  /**
   * Stream chat response
   */
  async* streamChatMessage(sessionId, message, options = {}) {
    const requestId = this.generateRequestId();
    
    try {
      const controller = new AbortController();
      this.abortControllers.set(requestId, controller);

      const response = await fetch(`${this.baseURL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          sessionId,
          message,
          options
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                yield { ...data, requestId };
              } catch (parseError) {
                console.warn('Failed to parse streaming data:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
        this.abortControllers.delete(requestId);
      }
    } catch (error) {
      this.abortControllers.delete(requestId);
      throw error;
    }
  }

  /**
   * Get chat conversation statistics
   */
  async getChatStats(sessionId) {
    return await this.makeRequest(`/chat/${sessionId}/stats`);
  }

  /**
   * Clear chat conversation
   */
  async clearChatConversation(sessionId) {
    return await this.makeRequest(`/chat/${sessionId}`, {
      method: 'DELETE',
    });
  }

  // =================== LLM FUNCTIONALITY ===================

  /**
   * Generate LLM response
   */
  async generateResponse(prompt, options = {}) {
    const requestId = this.generateRequestId();
    
    try {
      const controller = new AbortController();
      this.abortControllers.set(requestId, controller);

      const response = await this.makeRequest('/generate', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          prompt,
          options
        }),
      });

      this.abortControllers.delete(requestId);
      return { ...response, requestId };
    } catch (error) {
      this.abortControllers.delete(requestId);
      throw error;
    }
  }

  /**
   * Stream LLM response
   */
  async* streamLLMResponse(prompt, options = {}) {
    const requestId = this.generateRequestId();
    
    try {
      const controller = new AbortController();
      this.abortControllers.set(requestId, controller);

      const response = await fetch(`${this.baseURL}/generate/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          prompt,
          options
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                yield { ...data, requestId };
              } catch (parseError) {
                console.warn('Failed to parse streaming data:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
        this.abortControllers.delete(requestId);
      }
    } catch (error) {
      this.abortControllers.delete(requestId);
      throw error;
    }
  }

  // =================== MODEL MANAGEMENT ===================

  /**
   * Get available models
   */
  async getAvailableModels() {
    return await this.makeRequest('/models');
  }

  /**
   * Switch model
   */
  async switchModel(modelKey, config = null) {
    return await this.makeRequest(`/models/${modelKey}/switch`, {
      method: 'POST',
      body: JSON.stringify({ config }),
    });
  }

  // =================== DATA MANAGEMENT ===================

  /**
   * Clear service data
   */
  async clearData(serviceType, sessionId = null) {
    const url = `/data/${serviceType}${sessionId ? `?sessionId=${sessionId}` : ''}`;
    return await this.makeRequest(url, {
      method: 'DELETE',
    });
  }

  // =================== UTILITY METHODS ===================

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if services are ready
   */
  async isReady() {
    try {
      const status = await this.getStatus();
      return status.success && status.data.initialized;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for services to be ready
   */
  async waitForReady(timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const ready = await this.isReady();
        if (ready) return true;
      } catch (error) {
        // Continue waiting
      }
      
      // Wait 1 second before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('AI services did not become ready within timeout');
  }

  /**
   * Cancel all ongoing requests
   */
  cancelAllRequests() {
    this.abortControllers.forEach((controller, requestId) => {
      controller.abort();
    });
    this.abortControllers.clear();
  }
}

// Export singleton instance
export const aiApiService = new AIApiService();
export default aiApiService;