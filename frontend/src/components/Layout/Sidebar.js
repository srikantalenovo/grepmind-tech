import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Layout.css';
import { 
  FiGrid, 
  FiUser, 
  FiSettings, 
  FiBarChart2, 
  FiMail, 
  FiChevronLeft,
  FiChevronRight 
} from 'react-icons/fi';

const Sidebar = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <FiGrid size={20} /> },
    { path: '/analytics', label: 'Analytics', icon: <FiBarChart2 size={20} /> },
    { path: '/messages', label: 'Messages', icon: <FiMail size={20} /> },
    { path: '/profile', label: 'Profile', icon: <FiUser size={20} /> },
    { path: '/settings', label: 'Settings', icon: <FiSettings size={20} /> },
  ];

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h2><span className="grep">Grep</span><span className="mind">Mind</span></h2>
        <button 
          className="collapse-btn"
          onClick={toggleSidebar}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <FiChevronRight size={20} /> : <FiChevronLeft size={20} />}
        </button>
      </div>
      <nav className="sidebar-menu">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`menu-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            {item.icon}
            <span className="menu-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;