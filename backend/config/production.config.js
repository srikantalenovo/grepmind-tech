/**
 * Production Configuration for GrepMind Tech Backend
 * 
 * This configuration ensures robust operation in production environments
 * with proper fallback handling and error recovery.
 */

export const productionConfig = {
  // Server Configuration
  server: {
    port: process.env.PORT || 5000,
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'production',
    timeout: 30000, // 30 seconds
    maxRequestSize: '10mb'
  },

  // AI Model Configuration
  ai: {
    // Model loading timeout (5 minutes)
    modelLoadTimeout: 300000,
    
    // Maximum retries for model operations
    maxRetries: 3,
    
    // Fallback mode configuration
    fallback: {
      enabled: true,
      responseTimeout: 5000,
      maxResponseLength: 2000,
      enableIntelligentResponses: true
    },

    // Model priorities (1 = highest priority)
    modelPriorities: {
      chat: {
        'tinyllama-1.1b-chat-v1.0': 1,
        'phi-3-mini': 2
      },
      llm: {
        'Llama-3.2-3B-Instruct': 1,
        'Llama-3.1-8B-Instruct': 2
      }
    },

    // Model constraints
    constraints: {
      maxModelSize: '5GB',
      cpuOnly: true,
      gpuLayers: 0,
      threads: process.env.AI_THREADS || 4
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: true,
    enableFile: process.env.ENABLE_FILE_LOGGING === 'true',
    logFile: './logs/app.log',
    maxLogSize: '10MB',
    maxLogFiles: 5
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control'
    ]
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  },

  // Health Check Configuration
  health: {
    enableHealthCheck: true,
    endpoint: '/health',
    includeSystemInfo: process.env.INCLUDE_SYSTEM_INFO === 'true',
    checkModels: true,
    checkMemory: true
  },

  // Security Configuration
  security: {
    enableHelmet: true,
    trustProxy: process.env.TRUST_PROXY === 'true',
    enableCompression: true,
    maxRequestBodySize: '10mb'
  },

  // Performance Configuration
  performance: {
    enableCaching: process.env.ENABLE_CACHING !== 'false',
    cacheTimeout: 300000, // 5 minutes
    enableGzipCompression: true,
    keepAliveTimeout: 5000
  },

  // Error Handling
  errorHandling: {
    enableStackTrace: process.env.NODE_ENV !== 'production',
    enableErrorLogging: true,
    enableNotification: process.env.ENABLE_ERROR_NOTIFICATIONS === 'true',
    maxErrorsPerMinute: 10
  },

  // Monitoring Configuration
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    metricsEndpoint: '/metrics',
    enableResponseTime: true,
    enableMemoryUsage: true
  }
};

// Validation function for configuration
export function validateProductionConfig() {
  const errors = [];

  // Validate server configuration
  if (!productionConfig.server.port || productionConfig.server.port < 1 || productionConfig.server.port > 65535) {
    errors.push('Invalid server port configuration');
  }

  // Validate AI configuration
  if (!productionConfig.ai.modelLoadTimeout || productionConfig.ai.modelLoadTimeout < 10000) {
    errors.push('Model load timeout must be at least 10 seconds');
  }

  // Validate logging configuration
  if (!['error', 'warn', 'info', 'debug'].includes(productionConfig.logging.level)) {
    errors.push('Invalid logging level');
  }

  if (errors.length > 0) {
    throw new Error(`Production configuration validation failed: ${errors.join(', ')}`);
  }

  return true;
}

// Environment-specific overrides
export function getEnvironmentConfig() {
  const env = process.env.NODE_ENV || 'production';
  
  const envConfigs = {
    development: {
      logging: { level: 'debug' },
      errorHandling: { enableStackTrace: true },
      ai: { fallback: { enableIntelligentResponses: true } }
    },
    test: {
      logging: { level: 'warn', enableConsole: false },
      ai: { fallback: { enabled: true } },
      server: { port: 0 } // Random port for testing
    },
    production: {
      logging: { level: 'info' },
      errorHandling: { enableStackTrace: false },
      security: { enableHelmet: true }
    }
  };

  return { ...productionConfig, ...envConfigs[env] };
}

export default productionConfig;