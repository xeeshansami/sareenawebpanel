import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Pick several things from a long list.
 *
 * A sibling to SearchableSelect rather than a `multiple` flag on it: that
 * component is a single-value control used across the master-data pages, and
 * threading a second mode through its keyboard handling, its selected-label
 * rendering and its callers is a bigger change than writing the multi case
 * once, here.
 *
 * Chips rather than a native `<select multiple>` because the native one hides
 * what is chosen the moment the list scrolls, and requires ctrl-clicking to
 * add without wiping the rest — a shopkeeper picking six handsets loses the
 * lot on one stray click.
 *
 * Already-chosen entries drop out of the list, so the list only ever offers
 * something that changes the answer.
 */
export default function MultiSelectChips({
  values = [],
  onChange,
  options = [],
  placeholder = 'Search…',
  emptyHint = 'Nothing selected',
  getLabel = (o) => o.name,
  getValue = (o) => o._id,
  getMeta = null,
  disabled = false,
  id,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  const chosen = useMemo(
    () => values.map((v) => options.find((o) => String(getValue(o)) === String(v))).filter(Boolean),
    [values, options, getValue]
  );

  const available = useMemo(() => {
    const picked = new Set(values.map(String));
    const q = query.trim().toLowerCase();
    return options
      .filter((o) => !picked.has(String(getValue(o))))
      .filter((o) => {
        if (!q) return true;
        const meta = getMeta ? String(getMeta(o) ?? '') : '';
        return `${getLabel(o)} ${meta}`.toLowerCase().includes(q);
      })
      .slice(0, 80);          // a shop can hold hundreds of models
  }, [options, values, query, getValue, getLabel, getMeta]);

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const add = (o) => {
    onChange([...values, getValue(o)]);
    setQuery('');
    inputRef.current?.focus();
  };
  const remove = (v) => onChange(values.filter((x) => String(x) !== String(v)));

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <div
        className="chips-box"
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
          minHeight: 38, padding: 4, border: '1px solid var(--border)',
          borderRadius: 6, background: disabled ? 'var(--bg-muted)' : 'var(--bg)',
        }}
      >
        {chosen.map((o) => (
          <span key={getValue(o)} className="badge badge-blue" style={{ display: 'inline-flex', gap: 4 }}>
            {getLabel(o)}
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(getValue(o))}
                aria-label={`Remove ${getLabel(o)}`}
                style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
              >
                ×
              </button>
            )}
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          value={query}
          disabled={disabled}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && available.length) { e.preventDefault(); add(available[0]); }
            // Backspace on an empty box removes the last chip, the way every
            // tag input behaves.
            if (e.key === 'Backspace' && !query && values.length) remove(values[values.length - 1]);
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={chosen.length ? '' : placeholder}
          style={{ flex: 1, minWidth: 120, border: 0, outline: 'none', background: 'transparent', padding: '4px 6px' }}
        />
      </div>

      {open && !disabled && (
        <div
          className="card"
          style={{
            position: 'absolute', zIndex: 30, left: 0, right: 0, top: '100%', marginTop: 4,
            maxHeight: 220, overflowY: 'auto', padding: 4,
          }}
        >
          {available.length === 0 ? (
            <div className="small muted" style={{ padding: 8 }}>
              {query ? 'No match' : 'Everything is already selected'}
            </div>
          ) : (
            available.map((o) => (
              <button
                key={getValue(o)}
                type="button"
                onClick={() => add(o)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', border: 0,
                  background: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 4,
                }}
              >
                {getLabel(o)}
                {getMeta && getMeta(o) ? <span className="small muted"> · {getMeta(o)}</span> : null}
              </button>
            ))
          )}
        </div>
      )}

      {chosen.length === 0 && <div className="hint">{emptyHint}</div>}
    </div>
  );
}
