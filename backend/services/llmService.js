import { modelLoader } from '../utils/modelLoader.js';
import { AI_CONFIG, RESPONSE_TEMPLATES } from '../config/aiConfig.js';

class LLMService {
  constructor() {
    this.requestQueue = [];
    this.activeRequests = new Set();
    this.requestHistory = new Map(); // Store recent requests for context
    this.isProcessingQueue = false;
  }

  /**
   * Initialize LLM service
   */
  async initialize() {
    try {
      console.log('Initializing LLM Service...');
      
      // Ensure LLM model is loaded
      if (!modelLoader.isModelReady('llm')) {
        console.log('Loading LLM model...');
        await modelLoader.loadModel('llm');
      }
      
      console.log('LLM Service initialized successfully');
      return { success: true };
    } catch (error) {
      console.error('Failed to initialize LLM Service:', error);
      throw error;
    }
  }

  /**
   * Generate response for main prompt
   */
  async generateResponse(prompt, options = {}) {
    try {
      // Validate input
      if (!prompt || prompt.trim().length === 0) {
        throw new Error('Prompt cannot be empty');
      }

      if (prompt.length > AI_CONFIG.safety.maxInputLength) {
        throw new Error(`Prompt too long. Maximum length is ${AI_CONFIG.safety.maxInputLength} characters.`);
      }

      // Check concurrent request limits
      if (this.activeRequests.size >= AI_CONFIG.performance.maxConcurrentRequests) {
        if (AI_CONFIG.performance.requestQueue) {
          return await this.queueRequest(prompt, options);
        } else {
          throw new Error('Too many concurrent requests. Please try again later.');
        }
      }

      const requestId = this.generateRequestId();
      this.activeRequests.add(requestId);

      try {
        // Process the prompt
        const response = await this.processPrompt(prompt, options);

        // Store in request history
        this.addToHistory(prompt, response);

        return {
          success: true,
          response,
          requestId,
          timestamp: new Date().toISOString(),
          tokensUsed: this.estimateTokens(prompt + response),
          processingTime: Date.now() - options.startTime || 0
        };

      } finally {
        this.activeRequests.delete(requestId);
        this.processNextInQueue();
      }

    } catch (error) {
      console.error('Error generating LLM response:', error);
      return {
        success: false,
        error: error.message,
        response: RESPONSE_TEMPLATES.llm.error
      };
    }
  }

  /**
   * Process prompt with AI model
   */
  async processPrompt(prompt, options) {
    try {
      // Get the loaded LLM model
      const model = modelLoader.getModel('llm');
      
      // Prepare prompt with context
      const enrichedPrompt = this.enrichPrompt(prompt, options);
      
      // Generate response using Ollama
      console.log(`🔥 Processing prompt with ${model.name}...`);
      const response = await model.generate(enrichedPrompt, {
        maxTokens: options.maxTokens || AI_CONFIG.models.llm.maxTokens,
        temperature: options.temperature || AI_CONFIG.models.llm.temperature,
        stopSequences: options.stopSequences || [],
        topP: options.topP || 0.9,
        topK: options.topK || 40
      });

      // Post-process response
      return this.postProcessResponse(response, options);

    } catch (error) {
      console.error('Error processing prompt with LLM model:', error.message);
      
      // Return more specific error information
      if (error.message.includes('not loaded')) {
        return this.getFallbackResponse(prompt, 'Model not loaded. Please check Ollama setup.');
      } else if (error.message.includes('Ollama')) {
        return this.getFallbackResponse(prompt, 'Ollama connection issue. Please check if Ollama is running.');
      } else {
        return this.getFallbackResponse(prompt, error.message);
      }
    }
  }

  /**
   * Enrich prompt with context and instructions
   */
  enrichPrompt(prompt, options) {
    let enrichedPrompt = '';

    // Add system instruction
    if (options.systemInstruction) {
      enrichedPrompt += `System: ${options.systemInstruction}\n\n`;
    }

    // Add context from recent requests if available
    if (options.includeContext && this.requestHistory.size > 0) {
      enrichedPrompt += this.buildContextFromHistory();
    }

    // Add the main prompt
    enrichedPrompt += `User: ${prompt}\n\nAssistant: `;

    return enrichedPrompt;
  }

  /**
   * Build context from request history
   */
  buildContextFromHistory() {
    const recentRequests = Array.from(this.requestHistory.entries())
      .slice(-3) // Last 3 requests for context
      .map(([prompt, response]) => `Previous Q: ${prompt.slice(0, 100)}...\nPrevious A: ${response.slice(0, 200)}...`)
      .join('\n\n');

    return recentRequests ? `Recent context:\n${recentRequests}\n\nCurrent request:\n` : '';
  }

  /**
   * Post-process the generated response
   */
  postProcessResponse(response, options) {
    // Remove any unwanted prefixes or suffixes
    let cleanResponse = response.trim();

    // Remove common AI response prefixes
    const prefixesToRemove = [
      'Assistant: ',
      'AI: ',
      'Response: ',
      'Answer: '
    ];

    prefixesToRemove.forEach(prefix => {
      if (cleanResponse.startsWith(prefix)) {
        cleanResponse = cleanResponse.substring(prefix.length).trim();
      }
    });

    // Apply content filtering if enabled
    if (AI_CONFIG.safety.enableContentFilter) {
      cleanResponse = this.applyContentFilter(cleanResponse);
    }

    // Format response if requested
    if (options.formatResponse) {
      cleanResponse = this.formatResponse(cleanResponse, options.format);
    }

    return cleanResponse;
  }

  /**
   * Apply basic content filtering
   */
  applyContentFilter(text) {
    // Basic content filtering - in production, use more sophisticated filtering
    const blockedWords = AI_CONFIG.safety.blockedWords || [];
    
    let filteredText = text;
    blockedWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      filteredText = filteredText.replace(regex, '[FILTERED]');
    });

    return filteredText;
  }

  /**
   * Format response based on requested format
   */
  formatResponse(response, format) {
    switch (format) {
      case 'markdown':
        return this.formatAsMarkdown(response);
      case 'json':
        return this.formatAsJSON(response);
      case 'html':
        return this.formatAsHTML(response);
      default:
        return response;
    }
  }

  /**
   * Format response as markdown
   */
  formatAsMarkdown(response) {
    // Add basic markdown formatting
    return response
      .replace(/^(\d+\.\s)/gm, '\n$1') // Number lists
      .replace(/^(-\s)/gm, '\n$1')    // Bullet lists
      .replace(/\*\*(.*?)\*\*/g, '**$1**') // Bold
      .replace(/\*(.*?)\*/g, '*$1*');     // Italic
  }

  /**
   * Format response as JSON
   */
  formatAsJSON(response) {
    try {
      return JSON.stringify({ response }, null, 2);
    } catch (error) {
      return JSON.stringify({ response, error: 'Failed to format as JSON' }, null, 2);
    }
  }

  /**
   * Format response as HTML
   */
  formatAsHTML(response) {
    return response
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  /**
   * Get fallback response when AI model fails
   */
  getFallbackResponse(prompt, errorDetails = null) {
    const shortPrompt = prompt.slice(0, 50) + (prompt.length > 50 ? '...' : '');
    
    let errorMessage = '';
    if (errorDetails) {
      errorMessage = `\n\n**Error Details:** ${errorDetails}`;
    }

    // Provide helpful troubleshooting information
    return `I apologize, but I encountered an issue processing your request: "${shortPrompt}"${errorMessage}

**Troubleshooting Steps:**

1. **Check Ollama Status:**
   - Ensure Ollama is running: \`ollama serve\`
   - Verify available models: \`ollama list\`

2. **Install Required Models:**
   - For chat: \`ollama pull phi3:mini\`
   - For LLM: \`ollama pull llama3.2:3b\`

3. **Alternative Models:**
   - Try: \`ollama pull qwen2:1.5b\` (lightweight)
   - Try: \`ollama pull mistral:7b\` (more capable)

4. **Check Connection:**
   - Ollama should be running on http://localhost:11434
   - Test with: \`curl http://localhost:11434/api/tags\`

Once Ollama is properly set up with the required models, please try your request again. I'll be able to provide detailed, contextual responses to your questions.

Would you like help with any of these setup steps?`;
  }

  /**
   * Queue request when at capacity
   */
  async queueRequest(prompt, options) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        prompt,
        options: { ...options, startTime: Date.now() },
        resolve,
        reject,
        timestamp: Date.now()
      };

      this.requestQueue.push(queueItem);
      
      // Set timeout for queued requests
      setTimeout(() => {
        const index = this.requestQueue.indexOf(queueItem);
        if (index > -1) {
          this.requestQueue.splice(index, 1);
          reject(new Error('Request timeout while in queue'));
        }
      }, AI_CONFIG.api.timeout);
    });
  }

  /**
   * Process next request in queue
   */
  async processNextInQueue() {
    if (this.requestQueue.length === 0 || this.isProcessingQueue) {
      return;
    }

    if (this.activeRequests.size >= AI_CONFIG.performance.maxConcurrentRequests) {
      return;
    }

    this.isProcessingQueue = true;
    const queueItem = this.requestQueue.shift();

    try {
      const response = await this.generateResponse(queueItem.prompt, queueItem.options);
      queueItem.resolve(response);
    } catch (error) {
      queueItem.reject(error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Stream response for real-time updates
   */
  async* streamResponse(prompt, options = {}) {
    try {
      yield { type: 'status', content: 'Connecting to AI model...' };
      
      // Get the loaded LLM model
      const model = modelLoader.getModel('llm');
      
      // Prepare prompt with context
      const enrichedPrompt = this.enrichPrompt(prompt, options);
      
      yield { type: 'status', content: `Generating response with ${model.name}...` };
      
      // Use the model's streaming capability
      yield* model.stream(enrichedPrompt, {
        maxTokens: options.maxTokens || AI_CONFIG.models.llm.maxTokens,
        temperature: options.temperature || AI_CONFIG.models.llm.temperature,
        stopSequences: options.stopSequences || [],
        topP: options.topP || 0.9,
        topK: options.topK || 40
      });
      
    } catch (error) {
      console.error('Error streaming LLM response:', error.message);
      yield { 
        type: 'error', 
        content: `Streaming failed: ${error.message}. Please check if Ollama is running and models are available.`
      };
    }
  }

  /**
   * Add to request history
   */
  addToHistory(prompt, response) {
    this.requestHistory.set(prompt, response);
    
    // Keep only last 10 requests
    if (this.requestHistory.size > 10) {
      const firstKey = this.requestHistory.keys().next().value;
      this.requestHistory.delete(firstKey);
    }
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `llm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(text) {
    // Rough estimate: ~1.3 tokens per word
    return Math.ceil(text.split(/\s+/).length * 1.3);
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: modelLoader.isModelReady('llm'),
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length,
      requestHistory: this.requestHistory.size,
      modelStatus: modelLoader.getModelStatus('llm'),
      performance: {
        maxConcurrentRequests: AI_CONFIG.performance.maxConcurrentRequests,
        requestQueue: AI_CONFIG.performance.requestQueue
      }
    };
  }

  /**
   * Clear request history
   */
  clearHistory() {
    this.requestHistory.clear();
    return { success: true, message: 'Request history cleared' };
  }
}

// Export singleton instance
export const llmService = new LLMService();