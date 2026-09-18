import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage, API_BASE_URL, CAPS } from '../api/client.js';
import { landingFor } from '../utils/landing.js';
import { Link } from 'react-router-dom';

// Same shape the backend's Joi rule accepts, checked here so a typo is caught
// before a round trip and reported in plain language.
const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);


export default function Login() {
  const { login, isAuthenticated, booting, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (isAuthenticated && !booting) {
    return <Navigate to={location.state?.from || landingFor(user, CAPS)} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError('Enter your email address.');
      return;
    }
    if (!looksLikeEmail(cleanEmail)) {
      setError(`"${email.trim()}" is not a valid email address.`);
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const signedIn = await login(cleanEmail, password);
      // Role decides the landing page, not a fixed route (§37).
      navigate(location.state?.from || landingFor(signedIn, CAPS), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };



  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <img className="login-logo" src={`${import.meta.env.BASE_URL}parthub-192.png`} alt="" width="56" height="56" />
          <h1>PartHub</h1>
          <p>Sign in to manage your inventory</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>⚠</span>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner" /> Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <div className="login-api">
          <span>Server</span>
          <span className="mono">{API_BASE_URL}</span>
        </div>

        {/* This page is for shop staff. A customer who wandered in needs a way
            back to the shop rather than a form they cannot use. */}
        <div className="mt-3 small" style={{ textAlign: 'center' }}>
          Shopping for parts? <Link to="/">Browse the marketplace →</Link>
        </div>
      </div>
    </div>
  );
}
