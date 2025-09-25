import React, { useState, useCallback, useEffect } from 'react';
import './ForgotPassword.css';

const ForgotPassword = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState(null);

  // Prevent modal from closing accidentally
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

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
    e.stopPropagation(); // Prevent event bubbling
    
    try {
      // Input validation
      if (!email || !email.includes('@')) {
        setMessage('Please enter a valid email address');
        return;
      }

      setLoading(true);
      setMessage('');

      console.log('=== Starting Email Verification ===');
      console.log('Time:', new Date().toISOString());
      console.log('Email to verify:', email);

      const apiUrl = 'http://localhost:5000/api/auth/verify-email';
      console.log('API URL:', apiUrl);

      // First verify email exists in database
      console.log('Sending request with headers:', {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      });
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      console.log('=== Response Details ===');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));
      
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
        console.log('Response data:', data);
      } else {
        const text = await response.text();
        console.log('Non-JSON response:', text);
        throw new Error('Unexpected response format from server');
      }

      if (response.status === 404) {
        console.error('404 Error: Email not found');
        throw new Error('Email not found in our database. Please check and try again.');
      }

      if (!response.ok) {
        console.error('Response Error:', {
          status: response.status,
          statusText: response.statusText,
          data: data
        });
        throw new Error(data.errors?.[0]?.msg || 'Email verification failed');
      }

      if (!data.userId) {
        console.error('Missing userId in response:', data);
        throw new Error('Invalid response from server');
      }

      // If email exists, proceed to password reset step
      setUserId(data.userId);
      setStep(2);
      setMessage('Email verified successfully. Please set your new password.');
    } catch (err) {
      console.error('Verification error:', err);
      setMessage(err.message || 'Error verifying email. Please try again.');
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
    <div 
      className="forgot-password-overlay"
      onClick={(e) => {
        // Prevent closing when clicking the overlay
        e.stopPropagation();
      }}
    >
      <div 
        className="forgot-password-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className="close-button" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
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