import React, { useState, useRef, useEffect } from "react";
import { FiPlus, FiMic, FiArrowUp, FiChevronDown } from "react-icons/fi";
import "./styles.css";

function Dashboard() {
  const [mainPrompt, setMainPrompt] = useState("");
  const [isMainLoading, setIsMainLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const mainPromptRef = useRef(null);
  const messagesEndRef = useRef(null);
  const contentRef = useRef(null);

  const handleMainPromptChange = (e) => {
    const el = e.target;
    setMainPrompt(el.value);

    // auto-resize textarea
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const handleMainPromptSubmit = (e) => {
    e.preventDefault();
    if (!mainPrompt.trim()) return;

    setIsMainLoading(true);
    console.log("Send:", mainPrompt);

    // simulate send
    setTimeout(() => {
      setIsMainLoading(false);
      setMainPrompt("");
      if (mainPromptRef.current) {
        mainPromptRef.current.style.height = "auto"; // reset height
      }
      scrollToBottom();
    }, 1000);
  };

  const handleMainKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleMainPromptSubmit(e);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // detect scroll position to toggle button + fade
  const handleScroll = () => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50;
    setShowScrollBtn(!isAtBottom);
  };

  useEffect(() => {
    const container = contentRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Page Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-6 relative">
        <h1 className="text-xl font-semibold mb-4">Dashboard Content</h1>
        <div className="space-y-4">
          <p>Message 1</p>
          <p>Message 2</p>
          <p>Message 3</p>
          <p>Message 4</p>
          <p>Message 5</p>
          <p>Message 6</p>
          <p>Message 7</p>
          <p>Message 8</p>
          <p>Message 9</p>
          <p>Message 10</p>
          <div ref={messagesEndRef} />
        </div>

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
      </div>

      {/* Chat Input */}
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
  );
}

export default Dashboard;
