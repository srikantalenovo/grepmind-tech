import React, { useState } from 'react';
import './ForgotPassword.css';

const ForgotPassword = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState(null);

  const validatePassword = () => {
    // Check minimum length
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters long');
      return false;
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
      setMessage('Password must contain at least one number');
      return false;
    }

    // Check for at least one special character
    if (!/[!@#$%^&*]/.test(password)) {
      setMessage('Password must contain at least one special character (!@#$%^&*)');
      return false;
    }

    // Check password confirmation
    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleEmailVerification = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Input validation
      if (!email || !email.includes('@')) {
        setMessage('Please enter a valid email address');
        setLoading(false);
        return;
      }

      // First verify email exists in database
      const response = await fetch('http://localhost:5000/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      console.log('Verification response:', data); // For debugging

      if (response.status === 404) {
        setMessage('Email not found in our database. Please check and try again.');
        return;
      }

      if (!response.ok) {
        throw new Error(data.errors?.[0]?.msg || 'Email verification failed');
      }

      if (!data.userId) {
        throw new Error('Invalid response from server');
      }

      // If email exists, proceed to password reset step
      setUserId(data.userId);
      setStep(2);
      setMessage('Email verified successfully. Please set your new password.');
    } catch (err) {
      console.error('Verification error:', err); // For debugging
      setMessage(err.message || 'Error verifying email. Please try again.');
      setStep(1); // Ensure we stay on email verification step
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    
    // Client-side password validation
    if (!validatePassword()) return;

    setLoading(true);
    setMessage('');

    try {
      if (!userId) {
        throw new Error('Email verification required. Please go back and verify your email.');
      }

      // Update password in database
      const response = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.errors?.[0]?.msg || 'Failed to update password');
      }

      // Success handling
      setMessage('Password has been updated successfully! Redirecting to login...');
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setMessage(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-overlay">
      <div className="forgot-password-modal">
        <button 
          className="close-button" 
          onClick={(e) => {
            e.preventDefault();
            if (loading) return; // Prevent closing while loading
            if (window.confirm('Are you sure you want to cancel password reset?')) {
              onClose();
            }
          }}
        >
          &times;
        </button>
        <h2>Reset Password</h2>
        
        {step === 1 ? (
          <>
            <p>Enter your email address to verify your account.</p>
            <form onSubmit={handleEmailVerification}>
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {message && (
                <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
                  {message}
                </div>
              )}
              <button 
                type="submit" 
                disabled={loading || !email.includes('@')}
                className={loading ? 'loading' : ''}
              >
                {loading ? 'Verifying...' : 'Verify Email'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p>Enter your new password.</p>
            <form onSubmit={handlePasswordReset}>
              <input
                type="password"
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength="6"
              />
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength="6"
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </>
        )}
        
        {message && (
          <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;