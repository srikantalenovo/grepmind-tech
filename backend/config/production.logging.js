/**
 * Production Error Handling and Logging System
 * 
 * Comprehensive error management for GrepMind Tech Backend
 * Provides structured logging, error tracking, and recovery mechanisms
 */

import { productionConfig } from './production.config.js';
import fs from 'fs-extra';
import path from 'path';
import { performance } from 'perf_hooks';

class ProductionLogger {
  constructor() {
    this.logLevel = productionConfig.logging.level;
    this.enableConsole = productionConfig.logging.enableConsole;
    this.enableFile = productionConfig.logging.enableFile;
    this.logFile = productionConfig.logging.logFile;
    this.errorCounts = new Map();
    this.lastErrorReset = Date.now();
    this.initializeLogDirectory();
  }

  /**
   * Initialize log directory
   */
  async initializeLogDirectory() {
    try {
      if (this.enableFile) {
        const logDir = path.dirname(this.logFile);
        await fs.ensureDir(logDir);
        console.log(`📝 Log directory initialized: ${logDir}`);
      }
    } catch (error) {
      console.error('Failed to initialize log directory:', error.message);
    }
  }

  /**
   * Format log message with metadata
   */
  formatLogMessage(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      metadata: {
        ...metadata,
        pid: process.pid,
        memory: this.getMemoryUsage(),
        uptime: process.uptime()
      }
    };

    return logEntry;
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB'
    };
  }

  /**
   * Check if log level should be output
   */
  shouldLog(level) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    return levels[level] <= levels[this.logLevel];
  }

  /**
   * Write log to console
   */
  logToConsole(logEntry) {
    if (!this.enableConsole) return;

    const colorCodes = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow
      INFO: '\x1b[36m',  // Cyan
      DEBUG: '\x1b[90m'  // Gray
    };
    const resetColor = '\x1b[0m';

    const color = colorCodes[logEntry.level] || '';
    const consoleMessage = `${color}[${logEntry.timestamp}] ${logEntry.level}: ${logEntry.message}${resetColor}`;
    
    if (logEntry.metadata && Object.keys(logEntry.metadata).length > 0) {
      console.log(consoleMessage);
      console.log('  Metadata:', JSON.stringify(logEntry.metadata, null, 2));
    } else {
      console.log(consoleMessage);
    }
  }

  /**
   * Write log to file
   */
  async logToFile(logEntry) {
    if (!this.enableFile) return;

    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Main logging method
   */
  async log(level, message, metadata = {}) {
    if (!this.shouldLog(level)) return;

    const logEntry = this.formatLogMessage(level, message, metadata);
    
    // Output to console
    this.logToConsole(logEntry);
    
    // Output to file
    await this.logToFile(logEntry);
  }

  // Convenience methods
  async error(message, metadata = {}) {
    await this.log('error', message, metadata);
  }

  async warn(message, metadata = {}) {
    await this.log('warn', message, metadata);
  }

  async info(message, metadata = {}) {
    await this.log('info', message, metadata);
  }

  async debug(message, metadata = {}) {
    await this.log('debug', message, metadata);
  }

  /**
   * Track error frequency
   */
  trackError(errorType) {
    // Reset counter every minute
    if (Date.now() - this.lastErrorReset > 60000) {
      this.errorCounts.clear();
      this.lastErrorReset = Date.now();
    }

    const count = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, count + 1);

    return this.errorCounts.get(errorType);
  }

  /**
   * Check if error rate limit is exceeded
   */
  isErrorRateLimitExceeded(errorType) {
    const count = this.errorCounts.get(errorType) || 0;
    return count >= productionConfig.errorHandling.maxErrorsPerMinute;
  }
}

class ProductionErrorHandler {
  constructor(logger) {
    this.logger = logger;
    this.setupProcessHandlers();
  }

  /**
   * Setup process-level error handlers
   */
  setupProcessHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      await this.logger.error('Uncaught Exception', {
        error: this.formatError(error),
        stack: error.stack,
        critical: true
      });
      
      // Graceful shutdown
      console.log('🚨 Uncaught exception detected. Shutting down gracefully...');
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      await this.logger.error('Unhandled Promise Rejection', {
        reason: reason?.toString() || 'Unknown reason',
        promise: promise?.toString() || 'Unknown promise',
        stack: reason?.stack,
        critical: true
      });
    });

    // Handle warnings
    process.on('warning', async (warning) => {
      await this.logger.warn('Process Warning', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
      });
    });

    // Handle SIGTERM for graceful shutdown
    process.on('SIGTERM', async () => {
      await this.logger.info('SIGTERM received. Starting graceful shutdown...');
      // Add cleanup logic here
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      await this.logger.info('SIGINT received. Starting graceful shutdown...');
      process.exit(0);
    });
  }

  /**
   * Format error object for logging
   */
  formatError(error) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status,
      stack: productionConfig.errorHandling.enableStackTrace ? error.stack : undefined
    };
  }

  /**
   * Handle API errors
   */
  async handleAPIError(error, req, res, context = {}) {
    const errorId = this.generateErrorId();
    const errorType = error.name || 'APIError';
    
    // Track error frequency
    const errorCount = this.logger.trackError(errorType);
    
    // Log the error
    await this.logger.error('API Error', {
      errorId,
      error: this.formatError(error),
      request: {
        method: req.method,
        url: req.url,
        headers: this.sanitizeHeaders(req.headers),
        body: this.sanitizeRequestBody(req.body)
      },
      context,
      errorCount
    });

    // Determine response status
    const status = error.status || error.statusCode || 500;
    
    // Prepare error response
    const errorResponse = {
      error: true,
      errorId,
      message: this.getPublicErrorMessage(error, status),
      timestamp: new Date().toISOString()
    };

    // Include stack trace in development
    if (productionConfig.errorHandling.enableStackTrace) {
      errorResponse.stack = error.stack;
      errorResponse.details = error;
    }

    // Send response
    res.status(status).json(errorResponse);
  }

  /**
   * Handle AI service errors
   */
  async handleAIError(error, context = {}) {
    const errorId = this.generateErrorId();
    const errorType = 'AIServiceError';
    
    await this.logger.error('AI Service Error', {
      errorId,
      error: this.formatError(error),
      context,
      fallbackActivated: true
    });

    return {
      success: false,
      errorId,
      fallback: true,
      message: 'AI service temporarily unavailable. Using fallback response.'
    };
  }

  /**
   * Generate unique error ID
   */
  generateErrorId() {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get public-safe error message
   */
  getPublicErrorMessage(error, status) {
    // Don't expose internal details in production
    if (productionConfig.server.environment === 'production') {
      const publicMessages = {
        400: 'Bad Request - Please check your input',
        401: 'Unauthorized - Please check your credentials',
        403: 'Forbidden - You don\'t have permission to access this resource',
        404: 'Not Found - The requested resource was not found',
        429: 'Too Many Requests - Please slow down',
        500: 'Internal Server Error - Something went wrong on our end',
        502: 'Bad Gateway - Service temporarily unavailable',
        503: 'Service Unavailable - Please try again later'
      };
      
      return publicMessages[status] || 'An unexpected error occurred';
    }
    
    // In development, show actual error
    return error.message;
  }

  /**
   * Sanitize request headers for logging
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '***REDACTED***';
      }
    });
    
    return sanitized;
  }

  /**
   * Sanitize request body for logging
   */
  sanitizeRequestBody(body) {
    if (!body) return body;
    
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    
    const sanitizeObject = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      const result = Array.isArray(obj) ? [] : {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          result[key] = '***REDACTED***';
        } else if (typeof value === 'object') {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    };
    
    return sanitizeObject(sanitized);
  }

  /**
   * Create Express error handling middleware
   */
  createErrorMiddleware() {
    return async (error, req, res, next) => {
      await this.handleAPIError(error, req, res);
    };
  }

  /**
   * Create request logging middleware
   */
  createRequestLogger() {
    return async (req, res, next) => {
      const startTime = performance.now();
      
      // Log request
      await this.logger.info('API Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Log response when finished
      res.on('finish', async () => {
        const duration = Math.round(performance.now() - startTime);
        
        await this.logger.info('API Response', {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: `${duration}ms`,
          contentLength: res.get('Content-Length')
        });
      });

      next();
    };
  }
}

// Create singleton instances
export const productionLogger = new ProductionLogger();
export const productionErrorHandler = new ProductionErrorHandler(productionLogger);

// Export convenience functions
export const log = {
  error: (message, metadata) => productionLogger.error(message, metadata),
  warn: (message, metadata) => productionLogger.warn(message, metadata),
  info: (message, metadata) => productionLogger.info(message, metadata),
  debug: (message, metadata) => productionLogger.debug(message, metadata)
};

export default {
  logger: productionLogger,
  errorHandler: productionErrorHandler,
  log
};