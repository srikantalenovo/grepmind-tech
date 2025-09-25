import React, { useState } from 'react';
import './ForgotPassword.css';

const ForgotPassword = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Password reset link has been sent to your email.');
        setEmail('');
      } else {
        setMessage(data.errors?.[0]?.msg || 'Failed to send reset link');
      }
    } catch (err) {
      setMessage('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-overlay">
      <div className="forgot-password-modal">
        <button className="close-button" onClick={onClose}>&times;</button>
        <h2>Reset Password</h2>
        <p>Enter your email address to receive a password reset link.</p>
        
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        
        {message && (
          <div className={`message ${message.includes('error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;