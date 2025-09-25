import React from 'react';

const Dashboard = () => {
  return (
    <div>
      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>Total Users</h3>
          <p>1,234</p>
        </div>
        <div className="stat-card">
          <h3>Active Projects</h3>
          <p>56</p>
        </div>
        <div className="stat-card">
          <h3>Completed Tasks</h3>
          <p>789</p>
        </div>
      </div>

      <div className="recent-activity">
        <h2>Recent Activity</h2>
        <ul className="activity-list">
          <li className="activity-item">New user registration - John Doe</li>
          <li className="activity-item">Project "Website Redesign" completed</li>
          <li className="activity-item">Task "Update Documentation" assigned</li>
          <li className="activity-item">New comment on Project "Mobile App"</li>
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;