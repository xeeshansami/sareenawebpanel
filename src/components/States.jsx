export function Loading({ label = 'Loading…' }) {
  return (
    <div className="loading-block">
      <div className="spinner" />
      <div>{label}</div>
    </div>
  );
}

/**
 * An empty state can carry the action that fills it — the first thing someone
 * needs when a list is empty is usually the button that creates the first row.
 */
export function Empty({ icon = '∅', title = 'Nothing here yet', hint, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="strong">{title}</div>
      {hint && <div className="small mt-2">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="alert alert-error">
      <span>⚠</span>
      <div style={{ flex: 1 }}>{message}</div>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
