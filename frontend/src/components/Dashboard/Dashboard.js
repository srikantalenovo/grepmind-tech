import React, { useState, useRef, useEffect } from 'react';
import { FiPlus, FiMic, FiArrowUp, FiChevronDown } from 'react-icons/fi';
import upSquareIcon from '../../assets/upsqure.png';
import aiApiService from '../../services/aiApi.js';

const Dashboard = () => {
  // Main dashboard states
  const [mainPrompt, setMainPrompt] = useState('');
  const [mainResponses, setMainResponses] = useState([]);
  const [isMainLoading, setIsMainLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  
  // Chat widget states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatSessionId] = useState(() => aiApiService.generateSessionId());
  
  // AI service states
  const [isAIReady, setIsAIReady] = useState(false);
  const [aiError, setAiError] = useState(null);
  
  const mainPromptRef = useRef(null);
  const mainResponsesEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const chatMessagesEndRef = useRef(null);
  const contentRef = useRef(null);

  // Initialize AI services on component mount
  useEffect(() => {
    const initializeAI = async () => {
      try {
        console.log('🤖 Checking AI services status...');
        const ready = await aiApiService.isReady();
        
        if (ready) {
          setIsAIReady(true);
          setAiError(null);
          console.log('✅ AI services are ready');
        } else {
          console.log('⏳ Waiting for AI services to initialize...');
          await aiApiService.waitForReady(30000);
          setIsAIReady(true);
          setAiError(null);
          console.log('✅ AI services initialized successfully');
        }
      } catch (error) {
        console.error('❌ Failed to initialize AI services:', error);
        setAiError(error.message);
        setIsAIReady(false);
      }
    };

    initializeAI();
  }, []);

  // Scroll to bottom when main responses change
  const scrollMainToBottom = () => {
    mainResponsesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom when chat messages change
  const scrollChatToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom function for button
  const scrollToBottom = () => {
    mainResponsesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Detect scroll position to toggle button + fade
  const handleScroll = () => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50;
    setShowScrollBtn(!isAtBottom);
  };

  useEffect(() => {
    scrollMainToBottom();
  }, [mainResponses]); // Added effect for main responses

  useEffect(() => {
    scrollChatToBottom();
  }, [chatMessages]);

  useEffect(() => {
    const container = contentRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  // Toggle chat widget
  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  // Handle main dashboard prompt submission with real AI integration
  const handleMainPromptSubmit = async (e) => {
    e.preventDefault();
    
    if (!mainPrompt.trim()) return;

    // Check if AI services are ready
    if (!isAIReady) {
      console.warn('AI services not ready yet');
      return;
    }

    const promptText = mainPrompt;
    setMainPrompt('');
    setIsMainLoading(true);

    // Reset textarea height after clearing
    if (mainPromptRef.current) {
      mainPromptRef.current.style.height = 'auto';
    }

    try {
      // Create response object for streaming
      const responseObj = {
        id: Date.now(),
        prompt: promptText,
        response: '',
        timestamp: new Date().toLocaleString(),
        isStreaming: true,
        isComplete: false,
        requestId: null
      };
      
      // Add response to state immediately
      setMainResponses(prev => [...prev, responseObj]);
      setIsMainLoading(false);
      
      // Start streaming response from LLM
      try {
        for await (const chunk of aiApiService.streamLLMResponse(promptText)) {
          // Update the response object with the chunk data
          setMainResponses(prev => prev.map(item => 
            item.id === responseObj.id 
              ? { 
                  ...item, 
                  response: chunk.type === 'content' ? chunk.content : item.response,
                  isStreaming: !chunk.isComplete,
                  isComplete: chunk.isComplete || chunk.type === 'complete',
                  requestId: chunk.requestId || item.requestId,
                  error: chunk.type === 'error' ? chunk.content : item.error
                }
              : item
          ));

          // Handle different chunk types
          if (chunk.type === 'error') {
            console.error('Streaming error:', chunk.content);
            break;
          }
          
          if (chunk.type === 'complete' || chunk.isComplete) {
            break;
          }
        }
      } catch (streamError) {
        console.error('Streaming failed:', streamError);
        
        // Fallback to non-streaming API call
        try {
          const response = await aiApiService.generateResponse(promptText);
          
          if (response.success) {
            setMainResponses(prev => prev.map(item => 
              item.id === responseObj.id 
                ? { 
                    ...item, 
                    response: response.data.response,
                    isStreaming: false,
                    isComplete: true,
                    requestId: response.data.requestId
                  }
                : item
            ));
          } else {
            throw new Error(response.error);
          }
        } catch (fallbackError) {
          console.error('Fallback API call also failed:', fallbackError);
          
          // Use mock response as final fallback
          setMainResponses(prev => prev.map(item => 
            item.id === responseObj.id 
              ? { 
                  ...item, 
                  response: generateFallbackResponse(promptText),
                  isStreaming: false,
                  isComplete: true,
                  error: 'AI service temporarily unavailable, showing fallback response'
                }
              : item
          ));
        }
      }
      
    } catch (error) {
      console.error('Main prompt submission failed:', error);
      setIsMainLoading(false);
      
      // Create error response
      const errorResponse = {
        id: Date.now(),
        prompt: promptText,
        response: generateFallbackResponse(promptText),
        timestamp: new Date().toLocaleString(),
        isStreaming: false,
        isComplete: true,
        error: `Error: ${error.message}`
      };
      
      setMainResponses(prev => [...prev, errorResponse]);
    }
  };

  // Handle chat widget submission with real AI integration
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    
    if (!chatInput.trim() || isChatLoading) return;

    // Check if AI services are ready
    if (!isAIReady) {
      console.warn('AI services not ready yet');
      return;
    }

    const userMessage = {
      id: Date.now(),
      text: chatInput,
      isUser: true,
      timestamp: new Date().toLocaleTimeString()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Create placeholder AI message for streaming
      const aiMessageId = Date.now() + 1;
      const aiMessage = {
        id: aiMessageId,
        text: '',
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
        isStreaming: true,
        isComplete: false
      };
      
      setChatMessages(prev => [...prev, aiMessage]);

      // Stream chat response
      try {
        for await (const chunk of aiApiService.streamChatMessage(chatSessionId, userMessage.text)) {
          setChatMessages(prev => prev.map(msg => 
            msg.id === aiMessageId 
              ? { 
                  ...msg, 
                  text: chunk.type === 'content' ? chunk.content : msg.text,
                  isStreaming: !chunk.isComplete,
                  isComplete: chunk.isComplete || chunk.type === 'complete',
                  error: chunk.type === 'error' ? chunk.content : msg.error
                }
              : msg
          ));

          if (chunk.type === 'error') {
            console.error('Chat streaming error:', chunk.content);
            break;
          }
          
          if (chunk.type === 'complete' || chunk.isComplete) {
            break;
          }
        }
      } catch (streamError) {
        console.error('Chat streaming failed:', streamError);
        
        // Fallback to non-streaming chat API
        try {
          const response = await aiApiService.sendChatMessage(chatSessionId, userMessage.text);
          
          if (response.success) {
            setChatMessages(prev => prev.map(msg => 
              msg.id === aiMessageId 
                ? { 
                    ...msg, 
                    text: response.data.response,
                    isStreaming: false,
                    isComplete: true
                  }
                : msg
            ));
          } else {
            throw new Error(response.error);
          }
        } catch (fallbackError) {
          console.error('Fallback chat API call also failed:', fallbackError);
          
          // Use fallback response
          setChatMessages(prev => prev.map(msg => 
            msg.id === aiMessageId 
              ? { 
                  ...msg, 
                  text: generateChatFallbackResponse(userMessage.text),
                  isStreaming: false,
                  isComplete: true,
                  error: 'Chat service temporarily unavailable'
                }
              : msg
          ));
        }
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      
      // Create error message
      const errorMessage = {
        id: Date.now() + 1,
        text: generateChatFallbackResponse(userMessage.text),
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
        error: `Error: ${error.message}`
      };
      
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Generate chat fallback response
  const generateChatFallbackResponse = (input) => {
    const responses = [
      "I'm here to help! The AI chat service is temporarily unavailable, but I can still provide general guidance.",
      "Thanks for your message! While our AI services are being initialized, I can offer some basic assistance.",
      "I appreciate you reaching out! Our conversational AI is currently loading, but I'm here to help however I can.",
      "Hello! The chat AI is temporarily unavailable, but I'd be happy to provide general information.",
      "Thank you for your patience! Our AI services are starting up, but I can still try to assist you.",
    ];
    
    // Simple keyword-based responses for common queries
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
      return "Hello! I'm your AI assistant. While our services are initializing, I'm here to help with basic guidance.";
    }
    
    if (lowerInput.includes('help')) {
      return "I'm here to help! Our AI services are currently loading, but I can provide general assistance and guidance.";
    }
    
    return responses[Math.floor(Math.random() * responses.length)];
  };

  // Generate LLM fallback response
  const generateFallbackResponse = (prompt) => {
    const responses = [
      `I've received your prompt about "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}". Our AI services are currently initializing. In production mode, this would be processed by our LLM model to provide detailed, contextual responses. Please try again in a moment when the services are fully loaded.`,
      
      `Thank you for your query regarding "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}". Our AI language model is currently loading. Once ready, it will provide comprehensive analysis and insights for your request.`,
      
      `Your prompt about "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}" has been received. While our AI services are starting up, please note that the full AI capabilities will be available shortly for detailed processing.`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  };

  // Handle main prompt textarea auto-resize
  const handleMainPromptChange = (e) => {
    const el = e.target;
    setMainPrompt(el.value);
    
    // Auto-resize textarea with expanded height allowance
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px'; // Improved auto-resize
  };

  // Handle Enter key to send in main prompt
  const handleMainKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleMainPromptSubmit(e);
    }
  };

  return (
    <div className="dashboard-container">
      
      {/* AI Service Status Indicator */}
      <div className={`ai-status-indicator ${isAIReady ? 'ready' : 'loading'}`}>
        <div className="status-content">
          {isAIReady ? (
            <>
              <span className="status-dot ready"></span>
              <span className="status-text">AI Services Ready</span>
            </>
          ) : aiError ? (
            <>
              <span className="status-dot error"></span>
              <span className="status-text">AI Services Error: {aiError}</span>
            </>
          ) : (
            <>
              <span className="status-dot loading"></span>
              <span className="status-text">Initializing AI Services...</span>
            </>
          )}
        </div>
      </div>
      
      {/* Main Dashboard Content - Full Width with Prompt Interface */}
      <div ref={contentRef} className="main-dashboard">
        
        {/* Responses Display Area */}
        {mainResponses.length > 0 && (
          <div className="main-responses-area">
            {mainResponses.map((item) => (
              <div key={item.id} className="main-response-card">
                {/* User Input Bubble - Right Aligned */}
                <div className="user-input-bubble right-align">
                  <p className="user-input-text">{item.prompt}</p>
                </div>
                
                {/* Loading Dots (shown while streaming) - Right Aligned */}
                {item.isStreaming && (
                  <div className="dot-loader right-align">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                )}
                
                {/* AI Response Bubble (shown when response is available) - Right Aligned */}
                {item.response && (
                  <div className="ai-response-bubble right-align">
                    <p className="ai-response-text">
                      {item.response}
                      {item.isStreaming && <span className="streaming-cursor">|</span>}
                    </p>
                  </div>
                )}
              </div>
            ))}
            <div ref={mainResponsesEndRef} /> {/* Added scroll target for main responses */}
          </div>
        )}
        
        {/* Loading Indicator for New Request */}
        {isMainLoading && mainResponses.length === 0 && (
          <div className="main-loading-indicator">
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span>Processing your request...</span>
          </div>
        )}
        
        {/* Fade effect overlay */}
        {showScrollBtn && <div className="fade-overlay"></div>}

        {/* Floating scroll-to-bottom button */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="scroll-btn"
            title="Scroll to latest"
          >
            <FiChevronDown size={20} />
          </button>
        )}
        
        {/* Main Prompt Input Area - Bottom positioned */}
        <div className="main-prompt-container">
          <form onSubmit={handleMainPromptSubmit} className="main-prompt-form">
            <div className="main-input-wrapper">
              <FiPlus className="input-plus-icon" size={20} />
              <textarea
                ref={mainPromptRef}
                value={mainPrompt}
                onChange={handleMainPromptChange}
                onKeyPress={handleMainKeyPress}
                placeholder="Message GrepMind..."
                className="main-prompt-input"
                rows="1"
                disabled={isMainLoading}
              />
              <button type="button" className="mic-btn" title="Speak">
                <FiMic size={18} />
              </button>
              {mainPrompt.trim() && (
                <button
                  type="submit"
                  className="main-submit-btn"
                  disabled={isMainLoading}
                  title="Send"
                >
                  <FiArrowUp className="send-arrow" size={18} />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Chat Widget */}
      <div className={`chat-widget-container ${isChatOpen ? 'open' : ''}`}>
        <div className="chat-header">
          <h3>AI Assistant</h3>
          <button onClick={toggleChat} className="chat-minimize-btn">
            {isChatOpen ? '−' : '+'}
          </button>
        </div>
        
        {isChatOpen && (
          <div className="chat-content">
            <div className="chat-messages">
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-message ${message.isUser ? 'user' : 'ai'}`}
                >
                  <div className="message-content">
                    {message.text}
                  </div>
                  <div className="message-time">
                    {message.timestamp}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="chat-message ai">
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatMessagesEndRef} />
            </div>
            
            <form onSubmit={handleChatSubmit} className="chat-input-form">
              <div className="chat-input-container">
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type your message..."
                  className="chat-input"
                  disabled={isChatLoading}
                />
                <button
                  type="submit"
                  className="chat-send-btn"
                  disabled={!chatInput.trim() || isChatLoading}
                >
                  <span>→</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Chat Toggle Button (when chat is closed) */}
      {!isChatOpen && (
        <button onClick={toggleChat} className="chat-toggle-btn">
          💬 AI Assistant
        </button>
      )}
    </div>
  );
};

export default Dashboard;