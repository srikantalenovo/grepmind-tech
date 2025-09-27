/**
 * Production Configuration for GrepMind Tech Backend
 * 
 * Strict production configuration requiring real model inference
 * No fallback responses - production-grade AI services only
 */

export const productionConfig = {
  // Server Configuration
  server: {
    port: process.env.PORT || 5000,
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'production',
    timeout: 30000, // 30 seconds
    maxRequestSize: '10mb',
    productionMode: true
  },

  // AI Model Configuration - Production Requirements
  ai: {
    // Strict production requirements
    requireNativeSupport: true,
    allowFallback: false,
    
    // Model loading timeout (10 minutes for large models)
    modelLoadTimeout: 600000,
    
    // Maximum retries for model operations
    maxRetries: 3,
    
    // Production model requirements
    requirements: {
      minimumModelSize: '50MB', // Ensure substantial models
      requireValidation: true,
      strictErrorHandling: true
    },

    // Model priorities (1 = highest priority)
    modelPriorities: {
      chat: {
        'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf': 1,
        'phi-3-mini': 2
      },
      llm: {
        'Llama-3.2-3B-Instruct-Q4_K_M.gguf': 1,
        'Llama-3.1-8B-Instruct': 2
      }
    },

    // Production model constraints
    constraints: {
      maxModelSize: '5GB',
      cpuOnly: true,
      gpuLayers: 0,
      threads: process.env.AI_THREADS || -1, // Auto-detect for production
      contextSize: 4096,
      batchSize: 512
    },

    // Production performance settings
    performance: {
      maxConcurrentRequests: 3,
      requestTimeout: 30000, // 30 seconds
      queueSize: 10,
      enableRequestQueue: true
    },

    // Production quality settings
    quality: {
      validateResponses: true,
      minimumResponseLength: 10,
      maximumResponseLength: 8000,
      enableContentValidation: true
    }
  },

  // Logging Configuration - Production Grade
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: true,
    enableFile: process.env.ENABLE_FILE_LOGGING === 'true',
    logFile: './logs/production.log',
    errorLogFile: './logs/errors.log',
    maxLogSize: '50MB',
    maxLogFiles: 10,
    
    // Structured logging for production
    format: 'json',
    enableTimestamps: true,
    enableCorrelationIds: true,
    enablePII: false, // Never log personally identifiable information
    
    // Log rotation
    rotateDaily: true,
    compressRotated: true
  },

  // CORS Configuration - Production Security
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : false,
    credentials: process.env.CORS_CREDENTIALS === 'true',
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'X-Request-ID'
    ],
    maxAge: 3600 // 1 hour
  },

  // Rate Limiting - Production Protection
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 100,
    message: {
      error: 'Rate limit exceeded',
      message: 'Too many requests from this IP. Please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    
    // Different limits for different endpoints
    endpointLimits: {
      '/api/ai/chat': 60,      // 60 requests per 15 minutes
      '/api/ai/generate': 30,   // 30 requests per 15 minutes
      '/api/ai/health': 300     // 300 requests per 15 minutes
    }
  },

  // Health Check Configuration - Production Monitoring
  health: {
    enableHealthCheck: true,
    endpoint: '/api/ai/health',
    includeSystemInfo: process.env.INCLUDE_SYSTEM_INFO === 'true',
    checkModels: true,
    checkMemory: true,
    checkNativeSupport: true,
    
    // Production health thresholds
    thresholds: {
      memoryUsage: 80,      // Alert if memory usage > 80%
      responseTime: 5000,   // Alert if response time > 5 seconds
      errorRate: 5,         // Alert if error rate > 5%
      cpuLoad: 80          // Alert if CPU load > 80%
    },
    
    // Health check intervals
    intervals: {
      quick: 30000,    // 30 seconds
      detailed: 300000  // 5 minutes
    }
  },

  // Security Configuration - Production Hardening
  security: {
    enableHelmet: true,
    trustProxy: process.env.TRUST_PROXY === 'true',
    enableCompression: true,
    maxRequestBodySize: '10mb',
    
    // Additional security headers
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'",
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    },
    
    // Request validation
    enableInputValidation: true,
    enableSanitization: true,
    blockSuspiciousRequests: true
  },

  // Performance Configuration - Production Optimization
  performance: {
    enableCaching: process.env.ENABLE_CACHING !== 'false',
    cacheTimeout: 300000, // 5 minutes
    enableGzipCompression: true,
    keepAliveTimeout: 5000,
    
    // Memory management
    enableGarbageCollection: true,
    gcInterval: 300000, // 5 minutes
    
    // Response optimization
    enableResponseCompression: true,
    compressionLevel: 6,
    compressionThreshold: 1024, // 1KB
    
    // Connection optimization
    maxConnections: 1000,
    connectionTimeout: 10000,
    enableConnectionPooling: true
  },

  // Error Handling - Production Reliability
  errorHandling: {
    enableStackTrace: false, // Never expose stack traces in production
    enableErrorLogging: true,
    enableNotification: process.env.ENABLE_ERROR_NOTIFICATIONS === 'true',
    maxErrorsPerMinute: 20,
    
    // Circuit breaker pattern
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000, // 1 minute
    
    // Retry configuration
    enableRetry: true,
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    
    // Error classification
    classifyErrors: true,
    trackErrorPatterns: true
  },

  // Monitoring Configuration - Production Observability
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    metricsEndpoint: '/metrics',
    enableResponseTime: true,
    enableMemoryUsage: true,
    enableModelMetrics: true,
    
    // Custom metrics
    customMetrics: {
      aiRequestDuration: true,
      modelLoadTime: true,
      errorsByType: true,
      concurrentRequests: true
    },
    
    // Alerting
    enableAlerting: process.env.ENABLE_ALERTING === 'true',
    alertWebhook: process.env.ALERT_WEBHOOK_URL,
    
    // Data retention
    metricsRetention: '7d',
    detailedMetricsRetention: '1d'
  },

  // Production-specific features
  production: {
    strictMode: true,
    validateEnvironment: true,
    requireHttps: process.env.REQUIRE_HTTPS === 'true',
    enableMaintenanceMode: process.env.MAINTENANCE_MODE === 'true',
    
    // Graceful shutdown
    enableGracefulShutdown: true,
    shutdownTimeout: 30000, // 30 seconds
    
    // Resource management
    enableResourceMonitoring: true,
    resourceThresholds: {
      memory: '1GB',
      cpu: 80,
      disk: '10GB'
    }
  }
};

// Validation function for production configuration
export function validateProductionConfig() {
  const errors = [];

  // Validate server configuration
  if (!productionConfig.server.port || productionConfig.server.port < 1 || productionConfig.server.port > 65535) {
    errors.push('Invalid server port configuration');
  }

  // Validate AI configuration - strict production requirements
  if (!productionConfig.ai.requireNativeSupport) {
    errors.push('Production mode requires native model support');
  }

  if (productionConfig.ai.allowFallback) {
    errors.push('Fallback responses not allowed in production mode');
  }

  if (!productionConfig.ai.modelLoadTimeout || productionConfig.ai.modelLoadTimeout < 60000) {
    errors.push('Model load timeout must be at least 60 seconds for production');
  }

  // Validate logging configuration
  if (!['error', 'warn', 'info', 'debug'].includes(productionConfig.logging.level)) {
    errors.push('Invalid logging level');
  }

  // Validate security configuration
  if (!productionConfig.security.enableHelmet) {
    errors.push('Security headers (Helmet) must be enabled in production');
  }

  // Validate CORS configuration
  if (productionConfig.cors.origin === '*') {
    console.warn('⚠️  CORS is set to allow all origins. Consider restricting for production.');
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
      security: { enableHelmet: false },
      cors: { origin: '*' },
      ai: { requireNativeSupport: false } // More lenient for development
    },
    test: {
      logging: { level: 'warn', enableConsole: false },
      server: { port: 0 }, // Random port for testing
      ai: { requireNativeSupport: false },
      security: { enableHelmet: false }
    },
    production: {
      logging: { level: 'info' },
      errorHandling: { enableStackTrace: false },
      security: { enableHelmet: true },
      ai: { requireNativeSupport: true, allowFallback: false }
    }
  };

  return { ...productionConfig, ...envConfigs[env] };
}

// Get production status
export function getProductionStatus() {
  return {
    mode: 'production',
    strictMode: productionConfig.production.strictMode,
    requireNativeSupport: productionConfig.ai.requireNativeSupport,
    fallbackDisabled: !productionConfig.ai.allowFallback,
    securityEnabled: productionConfig.security.enableHelmet,
    monitoringEnabled: productionConfig.monitoring.enableMetrics,
    timestamp: new Date().toISOString()
  };
}

export default productionConfig;