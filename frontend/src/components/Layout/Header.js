import React from 'react';
import './Layout.css';

const Header = ({ user }) => {
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  return (
    <header className="header">
      <div className="header-content">
        <h1>Dashboard</h1>
        <div className="header-right">
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