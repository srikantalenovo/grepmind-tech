import React, { useState, useEffect } from 'react';
import aiApiService from '../../services/aiApi.js';
import './Layout.css';

const Header = () => {
  const [user, setUser] = useState(null);
  const [isAIReady, setIsAIReady] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    const initializeAI = async () => {
      try {
        console.log('🤖 Checking AI services status in header...');
        const ready = await aiApiService.isReady();
        
        if (ready) {
          setIsAIReady(true);
          setAiError(null);
          console.log('✅ AI services are ready (header)');
        } else {
          console.log('⏳ Waiting for AI services to initialize (header)...');
          await aiApiService.waitForReady(30000);
          setIsAIReady(true);
          setAiError(null);
          console.log('✅ AI services initialized successfully (header)');
        }
      } catch (error) {
        console.error('❌ Failed to initialize AI services (header):', error);
        setAiError(error.message);
        setIsAIReady(false);
      }
    };

    fetchUserData();
    initializeAI();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  return (
    <header className="header">
      <div className="header-content">
        <h1>Dashboard</h1>
        <div className="header-right">
          {/* AI Services Ready Indicator */}
          <div className={`ai-status-header ${isAIReady ? 'ready' : 'loading'}`}>
            <div className="status-content">
              {isAIReady ? (
                <>
                  <span className="status-dot ready"></span>
                  <span className="status-text">AI Services Ready</span>
                </>
              ) : aiError ? (
                <>
                  <span className="status-dot error"></span>
                  <span className="status-text">AI Error</span>
                </>
              ) : (
                <>
                  <span className="status-dot loading"></span>
                  <span className="status-text">AI Loading</span>
                </>
              )}
            </div>
          </div>
          <span className="user-name">Welcome, {user?.name || 'User'}</span>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;