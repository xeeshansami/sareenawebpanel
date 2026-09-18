import { Component } from 'react';

/**
 * The last line between a render-time bug and a blank page.
 *
 * React unmounts the entire tree when a render throws, so one bad assumption
 * about an API response — reading `.length` on a field the server did not send
 * — takes the whole panel down to a white screen with the cause only in the
 * console. Nobody using the shop has a console open.
 *
 * This does not fix the bug. It makes the bug legible, keeps the sidebar and
 * the sign-in session alive, and offers the two things that actually recover:
 * try again, or go somewhere else.
 *
 * Deliberately a class: `componentDidCatch` has no hook equivalent.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the stack somewhere a developer can find it. The person looking at
    // the screen gets the sentence below instead.
    console.error('[ui] render failed', error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    // A new route should get a clean slate, or one broken page poisons every
    // page after it.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="card" style={{ maxWidth: 680, margin: '40px auto' }}>
        <div className="card-head">
          <h2>This page stopped working</h2>
        </div>
        <div className="card-body">
          <p className="mb-2">
            Something on this page hit an error while drawing. Your session is
            still signed in and nothing was saved or changed.
          </p>
          <p className="small muted mb-3">
            If it keeps happening, the most common cause is the panel talking to
            an API that is older or newer than it expects. Check which server it
            is pointed at on the sign-in screen.
          </p>

          <details className="mb-3">
            <summary className="small muted" style={{ cursor: 'pointer' }}>
              Technical detail
            </summary>
            <pre
              className="small mono"
              style={{
                whiteSpace: 'pre-wrap',
                marginTop: 8,
                padding: 10,
                background: 'var(--surface-2)',
                borderRadius: 8,
              }}
            >
              {String(error?.message || error)}
            </pre>
          </details>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => window.location.reload()}
            >
              Reload the panel
            </button>
          </div>
        </div>
      </div>
    );
  }
}
