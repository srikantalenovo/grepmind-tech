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
      
      // Prepare messages for chat model (Ollama chat format)
      const messages = this.buildMessagesArray(history, message);
      
      console.log(`💬 Processing chat with ${model.name}...`);
      
      // Use chat method for conversational models
      const response = await model.chat(messages, {
        maxTokens: options.maxTokens || AI_CONFIG.models.chat.maxTokens,
        temperature: options.temperature || AI_CONFIG.models.chat.temperature,
        topP: options.topP || 0.9,
        topK: options.topK || 40
      });

      return response;
    } catch (error) {
      console.error('Error processing message with AI model:', error.message);
      
      // Return more specific error information
      if (error.message.includes('not loaded')) {
        return this.getFallbackResponse(message, 'Chat model not loaded. Please check Ollama setup.');
      } else if (error.message.includes('Ollama')) {
        return this.getFallbackResponse(message, 'Ollama connection issue. Please check if Ollama is running.');
      } else {
        return this.getFallbackResponse(message, error.message);
      }
    }
  }

  /**
   * Build messages array for Ollama chat API
   */
  buildMessagesArray(history, currentMessage) {
    const messages = [];
    
    // Add system message
    messages.push({
      role: 'system',
      content: 'You are a helpful, friendly AI assistant. Provide clear, concise, and helpful responses in a conversational tone.'
    });
    
    // Add conversation history (limit to last 8 messages to avoid context overflow)
    const recentHistory = history.slice(-8);
    recentHistory.forEach(msg => {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    });
    
    // Add current message
    messages.push({
      role: 'user',
      content: currentMessage
    });
    
    return messages;
  }

  /**
   * Get fallback response when AI model fails
   */
  getFallbackResponse(message, errorDetails = null) {
    // If there's an error, provide troubleshooting info
    if (errorDetails) {
      return `I apologize, but I'm having trouble responding right now. 

**Error:** ${errorDetails}

**To fix this:**
1. Make sure Ollama is running: \`ollama serve\`
2. Install the chat model: \`ollama pull phi3:mini\`
3. Check available models: \`ollama list\`

Once the setup is complete, I'll be able to have a proper conversation with you!`;
    }

    // Regular conversation handling
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      return RESPONSE_TEMPLATES.chat.greeting;
    }
    
    if (lowerMessage.includes('help')) {
      return "I'm here to help! You can ask me questions about various topics, and I'll do my best to provide useful information and assistance. What would you like to know about?";
    }
    
    if (lowerMessage.includes('thanks') || lowerMessage.includes('thank you')) {
      return "You're very welcome! I'm glad I could help. Is there anything else you'd like to discuss?";
    }

    if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
      return "Goodbye! It was nice chatting with you. Feel free to come back anytime if you have more questions!";
    }

    // Default conversational responses
    const fallbackResponses = [
      "That's interesting! Could you tell me more about that?",
      "I'd love to help you with that. Can you provide a bit more detail?",
      "That's a great question! What specific aspect would you like to explore?",
      "I'm here to assist you. What would you like to know more about?",
      "Thanks for sharing that with me. How can I help you further?"
    ];

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
      yield { type: 'status', content: 'Thinking...' };
      
      // Check rate limiting
      if (this.isRateLimited(sessionId)) {
        yield { type: 'error', content: 'Rate limit exceeded. Please wait before sending another message.' };
        return;
      }

      // Get conversation history
      const history = this.getConversationHistory(sessionId);
      
      // Add user message to history
      history.push({
        role: 'user',
        content: message.trim(),
        timestamp: new Date().toISOString()
      });

      try {
        // Get the loaded chat model
        const model = modelLoader.getModel('chat');
        
        // Prepare messages for chat
        const messages = this.buildMessagesArray(history, message);
        
        yield { type: 'status', content: `Generating response with ${model.name}...` };
        
        // Stream the response
        let fullResponse = '';
        
        // Note: For chat models, we'll use the generate method and simulate streaming
        // since the Ollama chat API doesn't always support streaming in the same way
        const response = await model.chat(messages, {
          maxTokens: options.maxTokens || AI_CONFIG.models.chat.maxTokens,
          temperature: options.temperature || AI_CONFIG.models.chat.temperature
        });
        
        // Simulate streaming by breaking response into words
        const words = response.split(' ');
        
        for (let i = 0; i < words.length; i++) {
          fullResponse += words[i] + (i < words.length - 1 ? ' ' : '');
          yield { 
            type: 'content', 
            content: fullResponse,
            isComplete: i === words.length - 1
          };
          
          // Small delay for streaming effect
          await new Promise(resolve => setTimeout(resolve, 30));
        }
        
        // Add AI response to history
        history.push({
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date().toISOString()
        });

        // Update conversation history (keep last 20 messages)
        if (history.length > 20) {
          history.splice(0, history.length - 20);
        }
        this.conversationHistory.set(sessionId, history);

        // Update rate limiting
        this.updateRateLimit(sessionId);
        
      } catch (error) {
        console.error('Error streaming chat response:', error.message);
        yield { 
          type: 'error', 
          content: `Chat failed: ${error.message}. Please check if Ollama is running and chat model is available.`
        };
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