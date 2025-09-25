import React, { useState } from "react";

function SignUpForm() {
  const [state, setState] = useState({
    name: "",
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
      const { name, email, password } = state;
      const response = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.errors?.[0]?.msg || 'Signup failed');
      }

      // Store the token in localStorage
      localStorage.setItem('token', data.token);

      // Clear form
      setState({
        name: "",
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
    <div className="form-container sign-up-container">
      <form onSubmit={handleOnSubmit}>
        <h1>Create Account</h1>
        <div className="social-container">
          <button onClick={() => window.location.href='https://facebook.com'} className="social" aria-label="Sign up with Facebook">
            <i className="fab fa-facebook-f" />
          </button>
          <button onClick={() => window.location.href='https://google.com'} className="social" aria-label="Sign up with Google">
            <i className="fab fa-google-plus-g" />
          </button>
          <button onClick={() => window.location.href='https://linkedin.com'} className="social" aria-label="Sign up with LinkedIn">
            <i className="fab fa-linkedin-in" />
          </button>
        </div>
        <span>or use your email for registration</span>
        {error && <div className="error-message">{error}</div>}
        <input
          type="text"
          name="name"
          value={state.name}
          onChange={handleChange}
          placeholder="Name"
          required
          minLength="2"
        />
        <input
          type="email"
          name="email"
          value={state.email}
          onChange={handleChange}
          placeholder="Email"
          required
        />
        <input
          type="password"
          name="password"
          value={state.password}
          onChange={handleChange}
          placeholder="Password"
          required
          minLength="6"
        />
        <button disabled={loading}>
          {loading ? 'Signing up...' : 'Sign Up'}
        </button>
      </form>
    </div>
  );
}

export default SignUpForm;
