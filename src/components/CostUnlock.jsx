import { useState } from 'react';
import Modal from './Modal.jsx';
import { useCostUnlock } from '../context/CostUnlockContext.jsx';

/** Countdown so the user knows the unlock is temporary rather than sticky. */
function Remaining({ expiresAt }) {
  if (!expiresAt) return null;
  const mins = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000));
  return <span className="small muted">unlocks for {mins} more minute{mins === 1 ? '' : 's'}</span>;
}

/**
 * The button that stands in for a hidden cost figure.
 *
 * Placed where the number would be, so the absence reads as "locked" rather
 * than "zero" or "broken".
 */
export function CostUnlockButton({ label = 'Show purchase rates', compact = false }) {
  const { canUnlock, unlocked, setPrompting, lock, expiresAt } = useCostUnlock();

  if (!canUnlock) {
    return compact ? <span className="muted mono">••••</span> : (
      <span className="small muted">Purchase rates are hidden for your role</span>
    );
  }

  if (unlocked) {
    return (
      <span className="flex items-center gap-1">
        <Remaining expiresAt={expiresAt} />
        <button className="link-btn small" onClick={lock}>lock</button>
      </span>
    );
  }

  return (
    <button
      className={compact ? 'link-btn mono' : 'btn btn-ghost btn-sm'}
      onClick={() => setPrompting(true)}
      title="Enter your password to reveal purchase rates"
    >
      {compact ? '•••• show' : `🔒 ${label}`}
    </button>
  );
}

/** Mounted once in the layout; opens whenever anything asks to unlock. */
export function CostUnlockDialog() {
  const { prompting, setPrompting, unlock, error, busy } = useCostUnlock();
  const [password, setPassword] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const ok = await unlock(password);
    if (ok) setPassword('');
  };

  return (
    <Modal
      open={prompting}
      title="Show purchase rates"
      onClose={() => { setPrompting(false); setPassword(''); }}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => setPrompting(false)} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !password}>
            {busy ? <><span className="spinner" /> Verifying…</> : 'Verify'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && <div className="alert alert-error"><span>⚠</span><div>{error}</div></div>}

        <div className="alert alert-info">
          <span>🔒</span>
          <div>
            Purchase rates, margins and profit are released for a short window
            after you confirm your password. They are not sent to this browser
            before that.
          </div>
        </div>

        <div className="field">
          <label htmlFor="stepup">Your password</label>
          <input
            id="stepup"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <div className="hint">
            Five attempts are allowed, then the check is locked for fifteen minutes.
          </div>
        </div>
      </form>
    </Modal>
  );
}
