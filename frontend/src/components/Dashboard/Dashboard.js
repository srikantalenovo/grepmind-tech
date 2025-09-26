import React, { useState, useRef, useEffect } from 'react';
import { FiSend, FiUser, FiMessageCircle, FiTrash2, FiX, FiChevronUp } from 'react-icons/fi';

const Dashboard = () => {
  // Chat widget states
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Main dashboard states
  const [mainPrompt, setMainPrompt] = useState('');
  const [mainResponses, setMainResponses] = useState([]);
  const [isMainLoading, setIsMainLoading] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const mainPromptRef = useRef(null);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle sending messages in chat widget
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputValue.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: inputValue,
      isUser: true,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Simulate API response
    setTimeout(() => {
      const botResponse = {
        id: Date.now() + 1,
        text: generateResponse(inputValue),
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      };
      
      setMessages(prev => [...prev, botResponse]);
      setIsLoading(false);
    }, 1500);
  };

  // Handle main dashboard prompt submission
  const handleMainPromptSubmit = async (e) => {
    e.preventDefault();
    
    if (!mainPrompt.trim()) return;

    const promptText = mainPrompt;
    setMainPrompt('');
    setIsMainLoading(true);

    // Simulate API response
    setTimeout(() => {
      const response = {
        id: Date.now(),
        prompt: promptText,
        response: generateResponse(promptText),
        timestamp: new Date().toLocaleString()
      };
      
      setMainResponses(prev => [response, ...prev]);
      setIsMainLoading(false);
    }, 2000);
  };

  // Generate AI response
  const generateResponse = (prompt) => {
    const responses = [
      "Based on your query, here's what I found: This appears to be related to data analysis and processing. I recommend reviewing the latest metrics and trends.",
      "Great question! I've analyzed your request and here's my comprehensive response: The data suggests several key patterns that could be valuable for your decision-making process.",
      "Thank you for your inquiry. After processing your prompt, I can provide these insights: The current trends indicate significant opportunities for optimization.",
      "I understand your request. Here's my detailed analysis: The information you've provided suggests multiple approaches we could explore further.",
      "Excellent prompt! Based on my analysis: The data points to several interesting conclusions that could impact your strategic planning.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  // Clear chat history
  const clearChat = () => {
    setMessages([]);
  };

  // Handle chat widget textarea auto-resize
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  // Handle main prompt textarea auto-resize
  const handleMainPromptChange = (e) => {
    setMainPrompt(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  // Handle Enter key to send in chat widget
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
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
      
      {/* Main Dashboard Content - Full Width with Prompt Interface */}
      <div className="main-dashboard">
        
        {/* Responses Display Area */}
        {mainResponses.length > 0 && (
          <div className="main-responses-area">
            {mainResponses.map((item) => (
              <div key={item.id} className="main-response-card">
                <div className="response-header">
                  <span className="response-time">{item.timestamp}</span>
                  <span className="response-prompt">Prompt: "{item.prompt.substring(0, 60)}..."</span>
                </div>
                <div className="response-content">
                  {item.response}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Main Prompt Input Area */}
        <div className="main-prompt-container">
          <form onSubmit={handleMainPromptSubmit} className="main-prompt-form">
            <div className="main-input-wrapper">
              <textarea
                ref={mainPromptRef}
                value={mainPrompt}
                onChange={handleMainPromptChange}
                onKeyPress={handleMainKeyPress}
                placeholder="Enter your prompt here... (Press Enter to send, Shift+Enter for new line)"
                className="main-prompt-input"
                rows="3"
                disabled={isMainLoading}
              />
              <button
                type="submit"
                className={`main-submit-btn ${mainPrompt.trim() ? 'active' : ''}`}
                disabled={!mainPrompt.trim() || isMainLoading}
                title="Send prompt"
              >
                <FiSend />
              </button>
            </div>
            {isMainLoading && (
              <div className="main-loading-indicator">
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span>Processing your request...</span>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Floating Chat Widget */}
      <div className={`floating-chat-widget ${isChatOpen ? 'open' : ''}`}>
        
        {/* Chat Toggle Button */}
        <button 
          className="chat-toggle-btn"
          onClick={() => setIsChatOpen(!isChatOpen)}
        >
          {isChatOpen ? <FiX size={24} /> : <FiMessageCircle size={24} />}
          {!isChatOpen && <span className="chat-tooltip">AI Assistant</span>}
        </button>

        {/* Chat Panel */}
        {isChatOpen && (
          <div className="chat-panel">
            <div className="chat-header">
              <div className="chat-title">
                <FiMessageCircle className="chat-icon" />
                <h4>AI Assistant</h4>
              </div>
              <button onClick={clearChat} className="clear-chat-btn" title="Clear Chat">
                <FiTrash2 />
              </button>
            </div>

            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="welcome-message">
                  <FiMessageCircle size={24} />
                  <p>Hello! I'm your AI assistant. How can I help you today?</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`message ${message.isUser ? 'user-message' : 'bot-message'}`}
                  >
                    <div className="message-avatar">
                      {message.isUser ? <FiUser /> : <FiMessageCircle />}
                    </div>
                    <div className="message-content">
                      <div className="message-text">
                        {message.text}
                      </div>
                      <div className="message-time">{message.timestamp}</div>
                    </div>
                  </div>
                ))
              )}
              
              {isLoading && (
                <div className="message bot-message">
                  <div className="message-avatar">
                    <FiMessageCircle />
                  </div>
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
              <form onSubmit={handleSendMessage} className="chat-form">
                <div className="input-wrapper">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
                    className="chat-input"
                    rows="1"
                    disabled={isLoading}
                  />
                  
                  <div className="input-actions">
                    <div className="action-buttons">
                      <button
                        type="submit"
                        className={`send-btn ${inputValue.trim() ? 'active' : ''}`}
                        disabled={!inputValue.trim() || isLoading}
                        title="Send message"
                      >
                        <FiSend />
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;