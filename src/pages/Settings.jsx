import { useEffect, useState } from 'react';
import api, { errorMessage, API_BASE_URL } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { initials } from '../utils/format.js';

export default function Settings() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [health, setHealth] = useState({ state: 'checking' });

  const checkHealth = () => {
    setHealth({ state: 'checking' });
    api
      .get('/health')
      .then(({ data }) => setHealth({ state: 'ok', uptime: data.uptime }))
      .catch((err) => setHealth({ state: 'down', message: errorMessage(err) }));
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const changePassword = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (next.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (next !== confirm) {
      setMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      setMessage({ type: 'success', text: 'Password updated. Use it the next time you sign in.' });
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <div className="sub">Your profile, password and system status</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h2>Profile</h2></div>
          <div className="card-body">
            <div className="flex items-center gap-2 mb-3">
              <div className="avatar" style={{ width: 52, height: 52, fontSize: 19 }}>
                {initials(user?.firstName, user?.lastName)}
              </div>
              <div>
                <div className="strong" style={{ fontSize: 16 }}>{user?.firstName} {user?.lastName}</div>
                <div className="muted small">{user?.email}</div>
                <div className="mt-2"><span className="badge badge-blue">{user?.role}</span></div>
              </div>
            </div>

            <div className="flex" style={{ justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <span className="muted">Phone</span><span>{user?.phone || '—'}</span>
            </div>
            <div className="flex" style={{ justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <span className="muted">Permission level</span><span className="strong">{user?.roleLevel}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>System status</h2></div>
          <div className="card-body">
            <div className="flex" style={{ justifyContent: 'space-between', padding: '8px 0' }}>
              <span className="muted">API endpoint</span>
              <span className="mono small">{API_BASE_URL}</span>
            </div>
            <div className="flex" style={{ justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <span className="muted">Backend</span>
              <span>
                {health.state === 'checking' && <span className="badge badge-gray">Checking…</span>}
                {health.state === 'ok' && <span className="badge badge-green">Reachable</span>}
                {health.state === 'down' && <span className="badge badge-red">Unreachable</span>}
              </span>
            </div>
            {health.state === 'ok' && (
              <div className="flex" style={{ justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <span className="muted">Uptime</span>
                <span>{Math.floor(health.uptime / 60)} min</span>
              </div>
            )}
            {health.state === 'down' && (
              <div className="alert alert-error mt-2" style={{ marginBottom: 0 }}>
                <span>⚠</span>
                <div>{health.message}</div>
              </div>
            )}
            <button className="btn btn-ghost btn-sm mt-3" onClick={checkHealth}>Re-check</button>
          </div>
        </div>
      </div>

      <div className="card mt-3" style={{ maxWidth: 520 }}>
        <div className="card-head"><h2>Change password</h2></div>
        <div className="card-body">
          {message && (
            <div className={`alert alert-${message.type === 'error' ? 'error' : 'success'}`}>
              <span>{message.type === 'error' ? '⚠' : '✓'}</span>
              <div>{message.text}</div>
            </div>
          )}
          <form onSubmit={changePassword}>
            <div className="field">
              <label>Current password *</label>
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
            </div>
            <div className="field">
              <label>New password *</label>
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} autoComplete="new-password" />
              <div className="hint">At least 6 characters.</div>
            </div>
            <div className="field">
              <label>Confirm new password *</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Updating…</> : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
