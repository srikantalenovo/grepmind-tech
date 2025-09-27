import { modelLoader } from '../utils/modelLoader.js';
import { AI_CONFIG, RESPONSE_TEMPLATES } from '../config/aiConfig.js';

class ChatBotService {
  constructor() {
    this.conversationHistory = new Map(); // Store conversation per session
    this.activeChats = new Set();
    this.rateLimitMap = new Map(); // Simple rate limiting
  }

  /**
   * Initialize chat service
   */
  async initialize() {
    try {
      console.log('Initializing ChatBot Service...');
      
      // Ensure chat model is loaded
      if (!modelLoader.isModelReady('chat')) {
        console.log('Loading chat model...');
        await modelLoader.loadModel('chat');
      }
      
      console.log('ChatBot Service initialized successfully');
      return { success: true };
    } catch (error) {
      console.error('Failed to initialize ChatBot Service:', error);
      throw error;
    }
  }

  /**
   * Generate chat response
   */
  async generateResponse(sessionId, message, options = {}) {
    try {
      // Validate input
      if (!message || message.trim().length === 0) {
        throw new Error('Message cannot be empty');
      }

      // Check rate limiting
      if (this.isRateLimited(sessionId)) {
        throw new Error('Rate limit exceeded. Please wait before sending another message.');
      }

      // Get or create conversation history
      const history = this.getConversationHistory(sessionId);
      
      // Add user message to history
      history.push({
        role: 'user',
        content: message.trim(),
        timestamp: new Date().toISOString()
      });

      // Generate response using the loaded model
      const response = await this.processMessage(message, history, options);

      // Add AI response to history
      history.push({
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      });

      // Update conversation history (keep last 20 messages)
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }
      this.conversationHistory.set(sessionId, history);

      // Update rate limiting
      this.updateRateLimit(sessionId);

      return {
        success: true,
        response,
        sessionId,
        timestamp: new Date().toISOString(),
        messageCount: history.length
      };

    } catch (error) {
      console.error('Error generating chat response:', error);
      return {
        success: false,
        error: error.message,
        response: RESPONSE_TEMPLATES.chat.error
      };
    }
  }

  /**
   * Process message with AI model
   */
  async processMessage(message, history, options) {
    try {
      // Get the loaded chat model
      const model = modelLoader.getModel('chat');
      
      // Prepare context from conversation history
      const context = this.buildContext(history.slice(-10)); // Last 10 messages for context
      
      // Generate response
      const response = await model.generate(message, {
        context,
        maxTokens: options.maxTokens || AI_CONFIG.models.chat.maxTokens,
        temperature: options.temperature || AI_CONFIG.models.chat.temperature
      });

      return response;
    } catch (error) {
      console.error('Error processing message with AI model:', error);
      return this.getFallbackResponse(message);
    }
  }

  /**
   * Build context from conversation history
   */
  buildContext(history) {
    if (history.length === 0) {
      return 'You are a helpful AI assistant having a friendly conversation.';
    }

    let context = 'Conversation history:\n';
    history.forEach(msg => {
      context += `${msg.role}: ${msg.content}\n`;
    });
    
    return context;
  }

  /**
   * Get fallback response when AI model fails
   */
  getFallbackResponse(message) {
    const fallbackResponses = [
      "I understand you're asking about that. Could you provide a bit more detail?",
      "That's an interesting topic! I'd love to help you explore it further.",
      "I'm here to help! Can you tell me more about what you're looking for?",
      "Thanks for your message! What specific aspect would you like to discuss?",
      "I appreciate you reaching out. How can I assist you with that?"
    ];

    // Simple keyword-based responses
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return RESPONSE_TEMPLATES.chat.greeting;
    }
    
    if (lowerMessage.includes('help')) {
      return "I'm here to help! You can ask me questions about various topics, and I'll do my best to provide useful information and assistance.";
    }
    
    if (lowerMessage.includes('thanks') || lowerMessage.includes('thank you')) {
      return "You're welcome! I'm glad I could help. Is there anything else you'd like to know?";
    }

    // Return random fallback response
    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
  }

  /**
   * Get conversation history for a session
   */
  getConversationHistory(sessionId) {
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
    }
    return this.conversationHistory.get(sessionId);
  }

  /**
   * Clear conversation history
   */
  clearConversation(sessionId) {
    this.conversationHistory.delete(sessionId);
    return { success: true, message: 'Conversation history cleared' };
  }

  /**
   * Get conversation statistics
   */
  getConversationStats(sessionId) {
    const history = this.getConversationHistory(sessionId);
    const userMessages = history.filter(msg => msg.role === 'user').length;
    const assistantMessages = history.filter(msg => msg.role === 'assistant').length;
    
    return {
      totalMessages: history.length,
      userMessages,
      assistantMessages,
      conversationStarted: history.length > 0 ? history[0].timestamp : null,
      lastActivity: history.length > 0 ? history[history.length - 1].timestamp : null
    };
  }

  /**
   * Simple rate limiting
   */
  isRateLimited(sessionId) {
    const now = Date.now();
    const limit = AI_CONFIG.safety.rateLimit;
    
    if (!this.rateLimitMap.has(sessionId)) {
      this.rateLimitMap.set(sessionId, []);
    }
    
    const requests = this.rateLimitMap.get(sessionId);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < limit.windowMs);
    this.rateLimitMap.set(sessionId, validRequests);
    
    return validRequests.length >= limit.maxRequests;
  }

  /**
   * Update rate limit tracking
   */
  updateRateLimit(sessionId) {
    const now = Date.now();
    if (!this.rateLimitMap.has(sessionId)) {
      this.rateLimitMap.set(sessionId, []);
    }
    
    const requests = this.rateLimitMap.get(sessionId);
    requests.push(now);
    this.rateLimitMap.set(sessionId, requests);
  }

  /**
   * Stream response (for real-time chat)
   */
  async* streamResponse(sessionId, message, options = {}) {
    try {
      yield { type: 'status', content: RESPONSE_TEMPLATES.chat.thinking };
      
      const response = await this.generateResponse(sessionId, message, options);
      
      if (response.success) {
        // Simulate streaming by breaking response into chunks
        const words = response.response.split(' ');
        let currentText = '';
        
        for (let i = 0; i < words.length; i++) {
          currentText += words[i] + ' ';
          yield { 
            type: 'content', 
            content: currentText.trim(),
            isComplete: i === words.length - 1
          };
          
          // Small delay for streaming effect
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } else {
        yield { type: 'error', content: response.error };
      }
    } catch (error) {
      yield { type: 'error', content: error.message };
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: modelLoader.isModelReady('chat'),
      activeChats: this.activeChats.size,
      totalConversations: this.conversationHistory.size,
      modelStatus: modelLoader.getModelStatus('chat'),
      rateLimit: AI_CONFIG.safety.rateLimit
    };
  }
}

// Export singleton instance
export const chatBotService = new ChatBotService();