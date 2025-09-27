export const AI_CONFIG = {
  // Ollama connection settings
  ollama: {
    baseURL: 'http://localhost:11434',
    timeout: 60000,
    retries: 3
  },

  // Model configurations - supports both Ollama and local files
  models: {
    chat: {
      name: 'Qwen3-Embedding-0.6B-Q8_0.gguf',  // phi3:mini Lightweight conversational model
      type: 'conversational',
      maxTokens: 150,
      temperature: 0.7,
      description: 'Lightweight conversational model for chat widget',
      modelPath: './models/chat/',  // Local file path
      ollamaModel: 'Qwen3-Embedding-0.6B-Q8_0.gguf',     // phi3:mini Ollama model name
      isLocal: false,  // Will auto-detect and fallback to local if Ollama unavailable
      enabled: true,
      fallbackModels: ['Qwen3-Embedding-0.6B-Q8_0.gguf', 'llama3.2:3b', 'qwen2:1.5b'],  // Fallback options
      useLocalFallback: true  // Enable local file fallback
    },
    llm: {
      name: 'llama-3.2-1b-q4_k_m.gguf',  // llama3.2:3b Main LLM model
      type: 'text-generation',
      maxTokens: 2048,
      temperature: 0.6,
      description: 'Main LLM for prompt processing and text generation',
      modelPath: './models/llm/',   // Local file path
      ollamaModel: 'llama-3.2-1b-q4_k_m.gguf',  // llama3.2:3b Ollama model name
      isLocal: false,  // Will auto-detect and fallback to local if Ollama unavailable
      enabled: true,
      fallbackModels: ['llama-3.2-1b-q4_k_m.gguf', 'phi3:mini', 'qwen2:7b', 'mistral:7b'],  // Fallback options
      useLocalFallback: true  // Enable local file fallback
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