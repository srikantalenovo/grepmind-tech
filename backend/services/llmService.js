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
      
      // Generate response
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
      console.error('Error processing prompt with LLM model:', error);
      return this.getFallbackResponse(prompt);
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
  getFallbackResponse(prompt) {
    // Analyze prompt to provide contextual fallback
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('code') || lowerPrompt.includes('programming')) {
      return "I understand you're asking about programming or code. While I'm currently running in development mode with simulated responses, I can still try to help. Could you provide more specific details about what you're trying to accomplish?";
    }
    
    if (lowerPrompt.includes('explain') || lowerPrompt.includes('what is')) {
      return "You're asking for an explanation. I'd be happy to help break down complex topics. In the current development mode, I'm providing simulated responses, but I can still offer general guidance on your topic of interest.";
    }
    
    if (lowerPrompt.includes('help') || lowerPrompt.includes('how to')) {
      return "I see you're looking for help or guidance. While I'm currently in development mode with simulated AI responses, I can still provide general assistance. What specific area would you like help with?";
    }

    return `I've received your prompt about "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}". 

Currently running in development mode with simulated AI responses. In production, this would be processed by our minimal LLM model to provide detailed, contextual responses.

Key aspects I would address:
• Analysis of your specific request
• Relevant information and insights
• Actionable suggestions or solutions
• Follow-up questions for clarification

Is there a particular aspect of your request you'd like me to focus on?`;
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
      yield { type: 'status', content: RESPONSE_TEMPLATES.llm.processing };
      
      const response = await this.generateResponse(prompt, options);
      
      if (response.success) {
        yield { type: 'status', content: RESPONSE_TEMPLATES.llm.generating };
        
        // Simulate streaming by breaking response into sentences
        const sentences = response.response.split(/[.!?]+/).filter(s => s.trim());
        let currentText = '';
        
        for (let i = 0; i < sentences.length; i++) {
          currentText += sentences[i] + (i < sentences.length - 1 ? '. ' : '');
          yield { 
            type: 'content', 
            content: currentText.trim(),
            isComplete: i === sentences.length - 1
          };
          
          // Longer delay for LLM streaming
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } else {
        yield { type: 'error', content: response.error };
      }
    } catch (error) {
      yield { type: 'error', content: error.message };
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