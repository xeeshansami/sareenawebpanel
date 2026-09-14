import { useState } from 'react';
import { Link } from 'react-router-dom';
import publicApi from '../../api/publicApi.js';
import { useConsumer, publicError } from '../../context/ConsumerContext.jsx';
import { Empty } from '../../components/States.jsx';

export default function MyAccount() {
  const { consumer, isSignedIn, signOut } = useConsumer();
  const [form, setForm] = useState(() => ({
    name: consumer?.name || '',
    phone: consumer?.phone || '',
    city: consumer?.city || '',
    address: consumer?.address || '',
  }));
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (!isSignedIn) {
    return (
      <div className="store-page store-narrow">
        <Empty
          icon="☺"
          title="Sign in to see your details"
          action={<Link to="/signin" state={{ from: '/my/account' }} className="btn btn-primary">Sign in</Link>}
        />
      </div>
    );
  }

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      await publicApi.put('/consumer/me', form);
      setNotice('Your details are saved.');
    } catch (err) {
      setError(publicError(err));
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      await publicApi.post('/consumer/change-password', pw);
      setPw({ currentPassword: '', newPassword: '' });
      setNotice('Your password is changed.');
    } catch (err) {
      setError(publicError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="store-page store-narrow">
      <h1>Your details</h1>

      {notice && <div className="alert alert-success"><span>✓</span><div>{notice}</div></div>}
      {error && <div className="alert alert-error"><span>⚠</span><div>{error}</div></div>}

      <div className="card mb-3">
        <div className="card-body">
          <form onSubmit={save}>
            <div className="field">
              <label>Name</label>
              <input value={form.name} onChange={set('name')} minLength={2} required />
            </div>
            <div className="form-row">
              <div className="field">
                <label>Phone</label>
                <input value={form.phone} onChange={set('phone')} />
                <div className="hint">Shops use this to reach you about an order.</div>
              </div>
              <div className="field">
                <label>City</label>
                <input value={form.city} onChange={set('city')} />
              </div>
            </div>
            <div className="field">
              <label>Delivery address</label>
              <textarea value={form.address} onChange={set('address')} />
            </div>
            <div className="small muted mb-2">Signed in as {consumer.email}</div>
            <button className="btn btn-primary" disabled={busy}>Save details</button>
          </form>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-head"><h2>Password</h2></div>
        <div className="card-body">
          <form onSubmit={changePassword}>
            <div className="field">
              <label>Current password</label>
              <input
                type="password" autoComplete="current-password" required
                value={pw.currentPassword}
                onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>New password</label>
              <input
                type="password" autoComplete="new-password" required minLength={6}
                value={pw.newPassword}
                onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
              />
            </div>
            <button className="btn btn-ghost" disabled={busy}>Change password</button>
          </form>
        </div>
      </div>

      <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
