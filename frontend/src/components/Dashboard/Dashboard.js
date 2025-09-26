import React, { useState, useRef, useEffect } from 'react';
import { FiPlus, FiMic } from 'react-icons/fi';
import upSquareIcon from '../../assets/upsqure.png';

const Dashboard = () => {
  // Main dashboard states
  const [mainPrompt, setMainPrompt] = useState('');
  const [mainResponses, setMainResponses] = useState([]);
  const [isMainLoading, setIsMainLoading] = useState(false);
  
  // Chat widget states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const mainPromptRef = useRef(null);
  const mainResponsesEndRef = useRef(null); // Added ref for main responses scroll
  const chatInputRef = useRef(null);
  const chatMessagesEndRef = useRef(null);

  // Scroll to bottom when main responses change
  const scrollMainToBottom = () => {
    mainResponsesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom when chat messages change
  const scrollChatToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollMainToBottom();
  }, [mainResponses]); // Added effect for main responses

  useEffect(() => {
    scrollChatToBottom();
  }, [chatMessages]);

  // Toggle chat widget
  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  // Handle main dashboard prompt submission with AI integration
  const handleMainPromptSubmit = async (e) => {
    e.preventDefault();
    
    if (!mainPrompt.trim()) return;

    const promptText = mainPrompt;
    setMainPrompt('');
    setIsMainLoading(true);

    try {
      // Make API call to AI service
      const response = await fetch('https://api.example.com/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: promptText }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      
      // Create response object for streaming
      const responseObj = {
        id: Date.now(),
        prompt: promptText,
        response: '', // Will be filled during streaming
        fullResponse: data.response || generateResponse(promptText), // Fallback to mock response
        timestamp: new Date().toLocaleString(),
        isStreaming: true
      };
      
      // Add response to state and start streaming
      setMainResponses(prev => [...prev, responseObj]); // Changed to append at end for newest at bottom
      setIsMainLoading(false);
      
      // Start streaming the response word by word
      await streamResponse(responseObj.id, responseObj.fullResponse);
      
    } catch (error) {
      console.error('API call failed:', error);
      
      // Fallback to mock response with streaming
      const responseObj = {
        id: Date.now(),
        prompt: promptText,
        response: '',
        fullResponse: generateResponse(promptText),
        timestamp: new Date().toLocaleString(),
        isStreaming: true
      };
      
      setMainResponses(prev => [...prev, responseObj]); // Changed to append at end for newest at bottom
      setIsMainLoading(false);
      
      // Stream the fallback response
      await streamResponse(responseObj.id, responseObj.fullResponse);
    }
  };

  // Handle chat widget submission
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    
    if (!chatInput.trim() || isChatLoading) return;

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
      // Simulate API call for chat assistant
      setTimeout(() => {
        const aiMessage = {
          id: Date.now() + 1,
          text: generateChatResponse(userMessage.text),
          isUser: false,
          timestamp: new Date().toLocaleTimeString()
        };
        
        setChatMessages(prev => [...prev, aiMessage]);
        setIsChatLoading(false);
      }, 1000);
      
    } catch (error) {
      console.error('Chat error:', error);
      setIsChatLoading(false);
    }
  };

  // Generate chat response
  const generateChatResponse = (input) => {
    const responses = [
      "I'm here to help! What specific task would you like assistance with?",
      "Great question! I can help you with data analysis, content creation, or technical support.",
      "I understand. Let me provide some quick guidance on that topic.",
      "Thanks for reaching out! Here's what I recommend for your situation.",
      "I can definitely assist with that. Let me walk you through the process.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  // Stream response word by word
  const streamResponse = async (responseId, fullText) => {
    const words = fullText.split(' ');
    let currentText = '';
    
    for (let i = 0; i < words.length; i++) {
      currentText += (i > 0 ? ' ' : '') + words[i];
      
      setMainResponses(prev => prev.map(item => 
        item.id === responseId 
          ? { ...item, response: currentText, isStreaming: i < words.length - 1 }
          : item
      ));
      
      // Wait 50ms before next word
      if (i < words.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
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

  // Handle main prompt textarea auto-resize
  const handleMainPromptChange = (e) => {
    setMainPrompt(e.target.value);
    
    // Auto-resize textarea with expanded height allowance
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px'; // Increased from 200px to 300px for better multi-line support
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
        
        {/* Main Prompt Input Area - Bottom positioned */}
        <div className="main-prompt-container">
          <form onSubmit={handleMainPromptSubmit} className="main-prompt-form">
            <div className="main-input-wrapper">
              <FiPlus className="input-plus-icon" size={16} />
              <textarea
                ref={mainPromptRef}
                value={mainPrompt}
                onChange={handleMainPromptChange}
                onKeyPress={handleMainKeyPress}
                placeholder="Ask anything"
                className="main-prompt-input"
                rows="1"
                disabled={isMainLoading}
              />
              <FiMic className="input-mic-icon" size={16} />
              <button
                type="submit"
                className={`main-submit-btn ${mainPrompt.trim() ? 'active' : ''}`}
                disabled={!mainPrompt.trim() || isMainLoading}
                title="Send prompt"
              >
                <img src={upSquareIcon} alt="Submit" className="submit-icon" />
              </button>
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