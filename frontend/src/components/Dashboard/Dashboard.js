import React, { useState, useRef, useEffect } from 'react';
import { FiSend, FiUser, FiMessageCircle, FiTrash2, FiPaperclip, FiX, FiChevronUp } from 'react-icons/fi';

const Dashboard = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [aiResponses, setAiResponses] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

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
    
    if (!inputValue.trim() && !selectedFile) return;

    const userMessage = {
      id: Date.now(),
      text: inputValue,
      isUser: true,
      timestamp: new Date().toLocaleTimeString(),
      file: selectedFile
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setSelectedFile(null);
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

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Clear chat history
  const clearChat = () => {
    setMessages([]);
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
    <div className="dashboard-container">
      
      {/* Main Dashboard Content - Clean and Minimal */}
      <div className="main-dashboard">
        <div className="recent-activity">
          <h2>Live Activity Feed</h2>
          <ul className="activity-list">
            <li className="activity-item">New user registration - John Doe</li>
            <li className="activity-item">Project "Website Redesign" completed</li>
            <li className="activity-item">Task "Update Documentation" assigned</li>
            <li className="activity-item">New comment on Project "Mobile App"</li>
            <li className="activity-item">Database backup completed successfully</li>
            <li className="activity-item">System maintenance scheduled for tonight</li>
            <li className="activity-item">New feature request submitted</li>
            <li className="activity-item">User "Sarah Wilson" logged in</li>
          </ul>
        </div>
      </div>

      {/* Floating Chat Widget */}
      <div className={`floating-chat-widget ${isChatOpen ? 'open' : ''}`}>
        
        {/* Chat Toggle Button */}
        <button 
          className="chat-toggle-btn"
          onClick={() => setIsChatOpen(!isChatOpen)}
        >
          {isChatOpen ? <FiX /> : <FiMessageCircle />}
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
                        {message.file && (
                          <div className="message-file">
                            📎 {message.file.name}
                          </div>
                        )}
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
                    {selectedFile && (
                      <div className="selected-file">
                        <span>📎 {selectedFile.name}</span>
                        <button 
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="remove-file-btn"
                        >
                          <FiX />
                        </button>
                      </div>
                    )}
                    
                    <div className="action-buttons">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        className="attachment-btn"
                        disabled={isLoading}
                        title="Attach file"
                      >
                        <FiPaperclip />
                      </button>
                      
                      <button
                        type="submit"
                        className={`send-btn ${(inputValue.trim() || selectedFile) ? 'active' : ''}`}
                        disabled={(!inputValue.trim() && !selectedFile) || isLoading}
                        title="Send message"
                      >
                        <FiSend />
                      </button>
                    </div>
                  </div>
                </div>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.png,.gif"
                />
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;