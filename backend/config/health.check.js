/**
 * Production Health Check System
 * 
 * Comprehensive health monitoring for production model inference
 * Only reports status when real models are operational
 */

import { productionConfig } from './production.config.js';
import { localModelClient } from '../utils/localModelClient.js';
import os from 'os';
import fs from 'fs-extra';
import { performance } from 'perf_hooks';

class HealthCheckService {
  constructor() {
    this.startTime = Date.now();
    this.checks = new Map();
    this.lastHealthCheck = null;
    this.healthHistory = [];
    this.maxHistoryLength = 100;
  }

  /**
   * Perform comprehensive production health check
   */
  async performHealthCheck() {
    const startTime = performance.now();
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      productionMode: true,
      checks: {}
    };

    try {
      // System health checks
      health.checks.system = await this.checkSystemHealth();
      health.checks.memory = await this.checkMemoryHealth();
      health.checks.disk = await this.checkDiskHealth();
      
      // Production AI services - strict real model requirements
      health.checks.ai_services = await this.checkProductionAIServices();
      health.checks.models = await this.checkProductionModelsHealth();
      health.checks.native_support = await this.checkNativeSupport();
      
      // Performance metrics
      health.checks.performance = await this.checkPerformanceMetrics();
      
      // Determine overall status
      health.status = this.determineOverallStatus(health.checks);
      health.healthy = health.status === 'healthy';
      
      // Calculate check duration
      health.checkDuration = Math.round(performance.now() - startTime);
      
      // Store in history
      this.updateHealthHistory(health);
      this.lastHealthCheck = health;
      
      return health;
      
    } catch (error) {
      console.error('❌ Production health check failed:', error.message);
      return {
        status: 'unhealthy',
        healthy: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        productionMode: true,
        checkDuration: Math.round(performance.now() - startTime),
        issues: ['Health check system failure']
      };
    }
  }

  /**
   * Check system health metrics
   */
  async checkSystemHealth() {
    try {
      const cpuUsage = os.loadavg();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const uptime = os.uptime();
      
      const systemHealth = {
        status: 'healthy',
        cpu: {
          load_1m: cpuUsage[0],
          load_5m: cpuUsage[1],
          load_15m: cpuUsage[2],
          cores: os.cpus().length,
          model: os.cpus()[0]?.model || 'unknown'
        },
        memory: {
          total: totalMemory,
          free: freeMemory,
          used: totalMemory - freeMemory,
          usage_percent: Math.round(((totalMemory - freeMemory) / totalMemory) * 100)
        },
        system: {
          platform: os.platform(),
          arch: os.arch(),
          uptime: uptime,
          hostname: os.hostname(),
          node_version: process.version
        }
      };

      // Check for system resource issues
      if (systemHealth.memory.usage_percent > 85) {
        systemHealth.status = 'warning';
        systemHealth.warning = 'High system memory usage';
      }

      if (cpuUsage[0] > os.cpus().length * 2) {
        systemHealth.status = 'critical';
        systemHealth.warning = 'High CPU load detected';
      }
      
      return systemHealth;
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Check memory health with production thresholds
   */
  async checkMemoryHealth() {
    try {
      const memUsage = process.memoryUsage();
      const totalMemory = os.totalmem();
      
      const memoryHealth = {
        status: 'healthy',
        node_process: {
          rss: memUsage.rss,
          heap_total: memUsage.heapTotal,
          heap_used: memUsage.heapUsed,
          external: memUsage.external,
          array_buffers: memUsage.arrayBuffers
        },
        heap_usage_percent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        system_memory_percent: Math.round((memUsage.rss / totalMemory) * 100),
        formatted: {
          rss: this.formatBytes(memUsage.rss),
          heap_used: this.formatBytes(memUsage.heapUsed),
          heap_total: this.formatBytes(memUsage.heapTotal)
        }
      };

      // Production memory thresholds
      if (memoryHealth.heap_usage_percent > 80) {
        memoryHealth.status = 'warning';
        memoryHealth.warning = 'High heap usage - consider model optimization';
      }

      if (memoryHealth.system_memory_percent > 70) {
        memoryHealth.status = 'critical';
        memoryHealth.warning = 'Critical system memory usage - model performance may degrade';
      }

      return memoryHealth;
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Check disk health for production models
   */
  async checkDiskHealth() {
    try {
      const diskCheck = {
        status: 'healthy',
        workspace: await this.checkDirectorySize('./'),
        models: await this.checkModelDirectoryHealth(),
        logs: await this.checkDirectorySize('./logs/'),
        node_modules: await this.checkDirectorySize('./node_modules/')
      };

      return diskCheck;
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Check model directory health specifically
   */
  async checkModelDirectoryHealth() {
    try {
      const modelsDir = './models/';
      
      if (!(await fs.pathExists(modelsDir))) {
        return {
          status: 'error',
          exists: false,
          error: 'Models directory does not exist'
        };
      }

      const chatDir = './models/chat/';
      const llmDir = './models/llm/';

      const [chatInfo, llmInfo] = await Promise.all([
        this.getModelDirectoryInfo(chatDir),
        this.getModelDirectoryInfo(llmDir)
      ]);

      return {
        status: 'healthy',
        exists: true,
        chat: chatInfo,
        llm: llmInfo,
        total_size: chatInfo.total_size + llmInfo.total_size,
        total_models: chatInfo.model_count + llmInfo.model_count
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Get detailed model directory information
   */
  async getModelDirectoryInfo(dirPath) {
    try {
      if (!(await fs.pathExists(dirPath))) {
        return {
          exists: false,
          model_count: 0,
          total_size: 0,
          models: []
        };
      }

      const files = await fs.readdir(dirPath);
      const modelFiles = files.filter(f => f.endsWith('.gguf'));
      
      let totalSize = 0;
      const models = [];

      for (const file of modelFiles) {
        const filePath = `${dirPath}/${file}`;
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        models.push({
          name: file,
          size: stats.size,
          formatted_size: this.formatBytes(stats.size),
          modified: stats.mtime
        });
      }

      return {
        exists: true,
        model_count: modelFiles.length,
        total_size: totalSize,
        formatted_total_size: this.formatBytes(totalSize),
        models: models
      };
    } catch (error) {
      return {
        exists: false,
        error: error.message,
        model_count: 0,
        total_size: 0
      };
    }
  }

  /**
   * Check directory size utility
   */
  async checkDirectorySize(dirPath) {
    try {
      if (!(await fs.pathExists(dirPath))) {
        return { exists: false, size: 0 };
      }

      const stats = await fs.stat(dirPath);
      return {
        exists: true,
        size: stats.size,
        formatted_size: this.formatBytes(stats.size),
        modified: stats.mtime,
        accessible: true
      };
    } catch (error) {
      return {
        exists: false,
        error: error.message,
        accessible: false,
        size: 0
      };
    }
  }

  /**
   * Check production AI services - strict requirements
   */
  async checkProductionAIServices() {
    try {
      const modelStatus = localModelClient.getStatus();
      
      if (!modelStatus.initialized) {
        return {
          status: 'critical',
          error: 'Model client not initialized',
          initialized: false,
          native_support: modelStatus.nativeSupport,
          production_ready: false
        };
      }

      if (!modelStatus.nativeSupport) {
        return {
          status: 'critical',
          error: 'Native model support required for production',
          initialized: modelStatus.initialized,
          native_support: false,
          production_ready: false
        };
      }

      // Check if models are actually available
      const isAvailable = await localModelClient.isAvailable();
      if (!isAvailable) {
        return {
          status: 'critical',
          error: 'No production models available',
          initialized: true,
          native_support: true,
          models_available: false,
          production_ready: false
        };
      }

      return {
        status: 'healthy',
        initialized: true,
        native_support: true,
        models_available: true,
        production_ready: true,
        loaded_models: modelStatus.loadedModels,
        available_models: modelStatus.availableModels,
        fallback_mode: false
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        production_ready: false
      };
    }
  }

  /**
   * Check production models health
   */
  async checkProductionModelsHealth() {
    try {
      const models = await localModelClient.listModels();
      
      if (!models || models.length === 0) {
        return {
          status: 'critical',
          error: 'No production models found',
          models: [],
          count: 0,
          production_ready: false
        };
      }

      const modelHealth = {
        status: 'healthy',
        count: models.length,
        models: models.map(model => ({
          name: model.name,
          type: model.type,
          size: model.size,
          formatted_size: this.formatBytes(model.size),
          status: model.status,
          production: model.production
        })),
        production_ready: true,
        total_size: models.reduce((sum, model) => sum + model.size, 0)
      };

      modelHealth.formatted_total_size = this.formatBytes(modelHealth.total_size);

      // Check for minimum model requirements
      const hasChat = models.some(m => m.type === 'chat');
      const hasLlm = models.some(m => m.type === 'llm');

      if (!hasChat && !hasLlm) {
        modelHealth.status = 'warning';
        modelHealth.warning = 'No essential models loaded';
        modelHealth.production_ready = false;
      }

      return modelHealth;
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        production_ready: false
      };
    }
  }

  /**
   * Check native support specifically
   */
  async checkNativeSupport() {
    try {
      const modelStatus = localModelClient.getStatus();
      
      return {
        status: modelStatus.nativeSupport ? 'healthy' : 'critical',
        native_support: modelStatus.nativeSupport,
        node_llama_cpp: modelStatus.nativeSupport,
        fallback_mode: !modelStatus.nativeSupport,
        production_compatible: modelStatus.nativeSupport,
        message: modelStatus.nativeSupport 
          ? 'Native model support active' 
          : 'Native model support required for production'
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        native_support: false,
        production_compatible: false
      };
    }
  }

  /**
   * Check performance metrics
   */
  async checkPerformanceMetrics() {
    try {
      const eventLoopDelay = await this.measureEventLoopDelay();
      
      const performanceHealth = {
        status: 'healthy',
        event_loop_delay: eventLoopDelay,
        response_times: {
          average: this.getAverageResponseTime(),
          recent: this.getRecentResponseTimes()
        },
        memory_gc: {
          heap_limit: v8?.getHeapStatistics?.()?.heap_size_limit || 'unknown'
        }
      };

      // Performance thresholds
      if (eventLoopDelay > 100) {
        performanceHealth.status = 'warning';
        performanceHealth.warning = 'High event loop delay detected';
      }

      if (eventLoopDelay > 500) {
        performanceHealth.status = 'critical';
        performanceHealth.warning = 'Critical event loop delay - performance degraded';
      }

      return performanceHealth;
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Measure event loop delay
   */
  async measureEventLoopDelay() {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
        resolve(Math.round(delay * 100) / 100); // Round to 2 decimal places
      });
    });
  }

  /**
   * Get average response time (placeholder)
   */
  getAverageResponseTime() {
    // This would integrate with actual response time tracking
    return Math.random() * 1000 + 200; // Mock 200-1200ms
  }

  /**
   * Get recent response times (placeholder)
   */
  getRecentResponseTimes() {
    // This would return actual recent response times
    return [
      { timestamp: new Date().toISOString(), duration: 450 },
      { timestamp: new Date(Date.now() - 60000).toISOString(), duration: 320 },
      { timestamp: new Date(Date.now() - 120000).toISOString(), duration: 680 }
    ];
  }

  /**
   * Determine overall system status
   */
  determineOverallStatus(checks) {
    const statuses = Object.values(checks).map(check => check.status);
    
    if (statuses.includes('critical') || statuses.includes('error')) {
      return 'unhealthy';
    }
    
    if (statuses.includes('warning')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Update health history
   */
  updateHealthHistory(health) {
    this.healthHistory.push({
      timestamp: health.timestamp,
      status: health.status,
      duration: health.checkDuration
    });

    // Keep only recent history
    if (this.healthHistory.length > this.maxHistoryLength) {
      this.healthHistory.shift();
    }
  }

  /**
   * Get health history
   */
  getHealthHistory() {
    return this.healthHistory;
  }

  /**
   * Get last health check result
   */
  getLastHealthCheck() {
    return this.lastHealthCheck;
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get comprehensive system information
   */
  async getSystemInfo() {
    return {
      node_version: process.version,
      platform: process.platform,
      architecture: process.arch,
      cpu_count: os.cpus().length,
      total_memory: this.formatBytes(os.totalmem()),
      uptime: os.uptime(),
      load_average: os.loadavg(),
      hostname: os.hostname()
    };
  }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService();

/**
 * Express middleware for health checks
 */
export function healthCheckMiddleware(req, res, next) {
  healthCheckService.performHealthCheck()
    .then(health => {
      res.locals.healthCheck = health;
      next();
    })
    .catch(error => {
      res.locals.healthCheck = {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      next();
    });
}

export default healthCheckService;