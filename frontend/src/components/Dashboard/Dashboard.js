import React, { useState, useRef, useEffect } from 'react';
import { FiSend, FiUser, FiBot, FiTrash2 } from 'react-icons/fi';

const Dashboard = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your AI assistant. How can I help you today?",
      isUser: false,
      timestamp: new Date().toLocaleTimeString(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle sending messages
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputValue.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: inputValue,
      isUser: true,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Simulate API response (replace this with your actual API call)
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

  // Simple response generator (replace with actual AI integration)
  const generateResponse = (prompt) => {
    const responses = [
      "That's an interesting question! Let me help you with that.",
      "I understand what you're asking. Here's what I think...",
      "Great question! Based on your prompt, I would suggest...",
      "Thanks for asking! Here's my response to your query.",
      "I'm processing your request. This is a simulated response.",
    ];
    return responses[Math.floor(Math.random() * responses.length)] + 
           ` You asked: "${prompt}"`;
  };

  // Clear chat history
  const clearChat = () => {
    setMessages([
      {
        id: 1,
        text: "Hello! I'm your AI assistant. How can I help you today?",
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      }
    ]);
  };

  // Handle textarea auto-resize
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  // Handle Enter key to send
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div className="chat-dashboard">
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-title">
          <FiBot className="chat-icon" />
          <h2>AI Chat Assistant</h2>
        </div>
        <button onClick={clearChat} className="clear-chat-btn" title="Clear Chat">
          <FiTrash2 />
        </button>
      </div>

      {/* Chat Messages Area */}
      <div className="chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.isUser ? 'user-message' : 'bot-message'}`}
          >
            <div className="message-avatar">
              {message.isUser ? <FiUser /> : <FiBot />}
            </div>
            <div className="message-content">
              <div className="message-text">{message.text}</div>
              <div className="message-time">{message.timestamp}</div>
            </div>
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="message bot-message">
            <div className="message-avatar">
              <FiBot />
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

      {/* Chat Input Area */}
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
            <button
              type="submit"
              className={`send-btn ${inputValue.trim() ? 'active' : ''}`}
              disabled={!inputValue.trim() || isLoading}
            >
              <FiSend />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Dashboard;