export const AI_CONFIG = {
  // Model configurations for lightweight models
  models: {
    chat: {
      name: 'lightweight-chat',
      type: 'conversational',
      maxTokens: 150,
      temperature: 0.7,
      description: 'Lightweight conversational model for chat widget',
      modelPath: './models/chat/',
      isLocal: true,
      enabled: true
    },
    llm: {
      name: 'minimal-llm',
      type: 'text-generation',
      maxTokens: 500,
      temperature: 0.6,
      description: 'Minimal LLM for main prompt processing',
      modelPath: './models/llm/',
      isLocal: true,
      enabled: true
    }
  },
  
  // API configuration
  api: {
    timeout: 30000, // 30 seconds
    retries: 3,
    streamResponse: true,
    enableLogging: true
  },
  
  // Performance settings
  performance: {
    maxConcurrentRequests: 5,
    requestQueue: true,
    cacheResponses: false,
    modelWarmup: true
  },
  
  // Safety and content filtering
  safety: {
    enableContentFilter: true,
    maxInputLength: 2000,
    blockedWords: [],
    enableRateLimit: true,
    rateLimit: {
      windowMs: 60000, // 1 minute
      maxRequests: 30
    }
  }
};

export const RESPONSE_TEMPLATES = {
  chat: {
    greeting: "Hello! I'm your AI assistant. How can I help you today?",
    error: "I apologize, but I'm having trouble processing your request right now. Please try again.",
    thinking: "Let me think about that...",
    processing: "Processing your request..."
  },
  llm: {
    processing: "Analyzing your prompt...",
    generating: "Generating response...",
    error: "Unable to process the prompt. Please try rephrasing your request."
  }
};

export const MODEL_STATUS = {
  UNLOADED: 'unloaded',
  LOADING: 'loading',
  LOADED: 'loaded',
  ERROR: 'error',
  BUSY: 'busy'
};