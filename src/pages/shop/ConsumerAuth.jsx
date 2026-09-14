import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useConsumer, publicError } from '../../context/ConsumerContext.jsx';

/**
 * Shopper sign-in and sign-up, in one page with two modes.
 *
 * Separate from the staff login on purpose. A customer typing their details into
 * a page headed "Admin panel" is confusing at best, and the two go to different
 * collections behind the scenes anyway.
 */
export default function ConsumerAuth({ mode = 'signin' }) {
  const { signIn, signUp } = useConsumer();
  const navigate = useNavigate();
  const location = useLocation();
  const isSignup = mode === 'signup';

  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', city: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const back = location.state?.from || '/';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isSignup) {
        await signUp({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
          city: form.city || undefined,
        });
      } else {
        await signIn(form.email, form.password);
      }
      navigate(back, { replace: true });
    } catch (err) {
      setError(publicError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="store-page store-narrow">
      <div className="card">
        <div className="card-body">
          <h1 style={{ marginTop: 0 }}>{isSignup ? 'Create an account' : 'Sign in'}</h1>
          <p className="muted">
            {isSignup
              ? 'An account keeps your cart and your order history. Browsing needs no account at all.'
              : 'For your cart and your orders. Shop staff sign in from the link at the bottom of the page.'}
          </p>

          <form onSubmit={submit}>
            {error && <div className="alert alert-error"><span>⚠</span><div>{error}</div></div>}

            {isSignup && (
              <div className="field">
                <label htmlFor="name">Your name *</label>
                <input id="name" value={form.name} onChange={set('name')} required autoFocus minLength={2} />
              </div>
            )}

            <div className="field">
              <label htmlFor="email">Email *</label>
              <input
                id="email" type="email" value={form.email} onChange={set('email')}
                required autoFocus={!isSignup} autoComplete="email"
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password *</label>
              <input
                id="password" type="password" value={form.password} onChange={set('password')}
                required minLength={6}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
              {isSignup && <div className="hint">At least six characters.</div>}
            </div>

            {isSignup && (
              <div className="form-row">
                <div className="field">
                  <label htmlFor="phone">Phone</label>
                  <input id="phone" value={form.phone} onChange={set('phone')} placeholder="+92 300 1234567" />
                  <div className="hint">So the shop can reach you about an order.</div>
                </div>
                <div className="field">
                  <label htmlFor="city">City</label>
                  <input id="city" value={form.city} onChange={set('city')} />
                </div>
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy
                ? <><span className="spinner" /> {isSignup ? 'Creating…' : 'Signing in…'}</>
                : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="mt-3 small">
            {isSignup ? (
              <>Already have an account? <Link to="/signin" state={{ from: back }}>Sign in</Link></>
            ) : (
              <>New here? <Link to="/signup" state={{ from: back }}>Create an account</Link></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
