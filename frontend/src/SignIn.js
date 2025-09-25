import React, { useState } from "react";

function SignInForm() {
  const [state, setState] = useState({
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = evt => {
    const value = evt.target.value;
    setState({
      ...state,
      [evt.target.name]: value
    });
  };

  const handleOnSubmit = async (evt) => {
    evt.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { email, password } = state;
      const response = await fetch('http://localhost:5000/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.errors?.[0]?.msg || 'Invalid credentials');
      }

      // Store the token in localStorage
      localStorage.setItem('token', data.token);

      // Clear form
      setState({
        email: "",
        password: ""
      });

      // Redirect or update UI state
      window.location.href = '/dashboard'; // Update this based on your routing setup
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container sign-in-container">
      <form onSubmit={handleOnSubmit}>
        <h1>Sign in</h1>
        <div className="social-container">
          <button onClick={() => window.location.href='https://facebook.com'} className="social" aria-label="Sign in with Facebook">
            <i className="fab fa-facebook-f" />
          </button>
          <button onClick={() => window.location.href='https://google.com'} className="social" aria-label="Sign in with Google">
            <i className="fab fa-google-plus-g" />
          </button>
          <button onClick={() => window.location.href='https://linkedin.com'} className="social" aria-label="Sign in with LinkedIn">
            <i className="fab fa-linkedin-in" />
          </button>
        </div>
        <span>or use your account</span>
        {error && <div className="error-message" role="alert">{error}</div>}
        <input
          type="email"
          placeholder="Email"
          name="email"
          value={state.email}
          onChange={handleChange}
          required
          aria-label="Email"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={state.password}
          onChange={handleChange}
          required
          minLength="6"
          aria-label="Password"
        />
        <button onClick={() => window.location.href='/reset-password'} className="text-button">Forgot your password?</button>
        <button disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

export default SignInForm;
