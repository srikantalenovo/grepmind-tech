import express from 'express';
import { aiService } from '../services/aiService.js';

const router = express.Router();

// Middleware for error handling
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Middleware to ensure AI services are initialized
const ensureInitialized = async (req, res, next) => {
  try {
    if (!aiService.initialized) {
      console.log('AI services not initialized, initializing now...');
      const result = await aiService.initialize();
      if (!result.success) {
        return res.status(503).json({
          error: 'AI services initialization failed',
          details: result.error
        });
      }
    }
    next();
  } catch (error) {
    res.status(503).json({
      error: 'Failed to initialize AI services',
      details: error.message
    });
  }
};

// =================== INITIALIZATION & STATUS ===================

/**
 * Initialize AI services
 * POST /api/ai/initialize
 */
router.post('/initialize', asyncHandler(async (req, res) => {
  try {
    const result = await aiService.initialize();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'AI services initialized successfully',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to initialize AI services',
        details: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Initialization error',
      details: error.message
    });
  }
}));

/**
 * Get AI services status
 * GET /api/ai/status
 */
router.get('/status', asyncHandler(async (req, res) => {
  try {
    const status = aiService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get status',
      details: error.message
    });
  }
}));

/**
 * Health check endpoint
 * GET /api/ai/health
 */
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const health = await aiService.healthCheck();
    
    if (health.healthy) {
      res.json({
        success: true,
        healthy: true,
        data: health
      });
    } else {
      res.status(503).json({
        success: false,
        healthy: false,
        issues: health.issues,
        data: health
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      healthy: false,
      error: 'Health check failed',
      details: error.message
    });
  }
}));

// =================== CHAT ENDPOINTS ===================

/**
 * Process chat message
 * POST /api/ai/chat
 */
router.post('/chat', ensureInitialized, asyncHandler(async (req, res) => {
  try {
    const { message, sessionId, options = {} } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    const result = await aiService.processChat(sessionId, message, options);

    res.json({
      success: true,
      data: result,
      productionMode: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Chat processing failed',
      details: error.message
    });
  }
}));

/**
 * Stream chat response
 * POST /api/ai/chat/stream
 */
router.post('/chat/stream', ensureInitialized, asyncHandler(async (req, res) => {
  try {
    const { message, sessionId, options = {} } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        error: 'Message and sessionId are required'
      });
    }

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    try {
      for await (const chunk of aiService.streamChat(sessionId, message, options)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write('data: {"type":"complete"}\n\n');
    } catch (streamError) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: streamError.message })}\n\n`);
    }

    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Chat streaming failed',
        details: error.message
      });
    }
  }
}));

/**
 * Get chat conversation stats
 * GET /api/ai/chat/:sessionId/stats
 */
router.get('/chat/:sessionId/stats', ensureInitialized, asyncHandler(async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stats = aiService.services.chat.getConversationStats(sessionId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation stats',
      details: error.message
    });
  }
}));

/**
 * Clear chat conversation
 * DELETE /api/ai/chat/:sessionId
 */
router.delete('/chat/:sessionId', ensureInitialized, asyncHandler(async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = aiService.services.chat.clearConversation(sessionId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to clear conversation',
      details: error.message
    });
  }
}));

// =================== LLM ENDPOINTS ===================

/**
 * Process main prompt with LLM
 * POST /api/ai/generate
 */
router.post('/generate', ensureInitialized, asyncHandler(async (req, res) => {
  try {
    const { prompt, options = {} } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    const result = await aiService.processPrompt(prompt, options);

    res.json({
      success: true,
      data: result,
      productionMode: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'LLM processing failed',
      details: error.message
    });
  }
}));

/**
 * Stream LLM response
 * POST /api/ai/generate/stream
 */
router.post('/generate/stream', ensureInitialized, asyncHandler(async (req, res) => {
  try {
    const { prompt, options = {} } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: 'Prompt is required'
      });
    }

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    try {
      for await (const chunk of aiService.streamPrompt(prompt, options)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write('data: {"type":"complete"}\n\n');
    } catch (streamError) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: streamError.message })}\n\n`);
    }

    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        error: 'LLM streaming failed',
        details: error.message
      });
    }
  }
}));

// =================== MODEL MANAGEMENT ===================

/**
 * Get available models
 * GET /api/ai/models
 */
router.get('/models', asyncHandler(async (req, res) => {
  try {
    const models = aiService.getAvailableModels();
    res.json({
      success: true,
      data: models
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get models',
      details: error.message
    });
  }
}));

/**
 * Switch model
 * POST /api/ai/models/:modelKey/switch
 */
router.post('/models/:modelKey/switch', ensureInitialized, asyncHandler(async (req, res) => {
  try {
    const { modelKey } = req.params;
    const { config } = req.body;

    const result = await aiService.switchModel(modelKey, config);

    if (result.success) {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Model switch failed',
      details: error.message
    });
  }
}));

// =================== DATA MANAGEMENT ===================

/**
 * Clear service data
 * DELETE /api/ai/data/:serviceType
 */
router.delete('/data/:serviceType', ensureInitialized, asyncHandler(async (req, res) => {
  try {
    const { serviceType } = req.params;
    const { sessionId } = req.query;

    const result = await aiService.clearData(serviceType, sessionId);

    if (result.success) {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Data clearing failed',
      details: error.message
    });
  }
}));

// =================== ERROR HANDLING ===================

// Global error handler for AI routes
router.use((error, req, res, next) => {
  console.error('AI API Error:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error in AI service',
    details: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
  });
});

export default router;