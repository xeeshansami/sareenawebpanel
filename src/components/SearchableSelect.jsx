import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * A select you can type into.
 *
 * A plain `<select>` stopped being usable the moment the master lists became
 * the shop's own data: a seeded shop carries around three hundred handset
 * models, and finding "Galaxy S24 Ultra" in a native dropdown means scrolling
 * past two hundred others. Typing three characters is the whole interaction.
 *
 * Filtering happens here, against the list already in memory, because the
 * product form has all five lists from `/products/options` before it opens.
 * Going back to the server per keystroke would add latency to a search over a
 * few hundred rows that the browser does instantly.
 *
 * Keyboard first: ↑/↓ move, Enter picks, Escape closes, and typing filters. A
 * dropdown that only answers to a mouse is slower than the native control it
 * replaced.
 */
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  emptyLabel = 'Not set',
  disabled = false,
  allowEmpty = true,
  getLabel = (o) => o.name,
  getValue = (o) => o._id,
  getMeta = null,
  id,
  required = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = useMemo(
    () => options.find((o) => String(getValue(o)) === String(value)) || null,
    [options, value, getValue]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // Match the label and whatever the caller shows beside it, so a model is
    // findable by its brand as well as its own name.
    return options.filter((o) => {
      const label = String(getLabel(o)).toLowerCase();
      const meta = getMeta ? String(getMeta(o) ?? '').toLowerCase() : '';
      return label.includes(q) || meta.includes(q);
    });
  }, [options, query, getLabel, getMeta]);

  // Close when the click lands anywhere else.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // Focus after paint, or the field is not in the document yet.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const pick = (option) => {
    onChange(option ? String(getValue(option)) : '');
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (matches[active]) pick(matches[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="ss" ref={boxRef}>
      <button
        type="button"
        id={id}
        className={`ss-control ${disabled ? 'is-disabled' : ''}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? '' : 'ss-placeholder'}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <span className="ss-caret">▾</span>
      </button>

      {/* The real value, so the browser's own "please fill this in" works and a
          form submit sees the field. */}
      <input
        type="text"
        tabIndex={-1}
        aria-hidden="true"
        required={required}
        value={value || ''}
        onChange={() => {}}
        style={{
          position: 'absolute', opacity: 0, height: 0, width: 0,
          padding: 0, border: 0, pointerEvents: 'none',
        }}
      />

      {open && (
        <div className="ss-menu">
          <input
            ref={inputRef}
            className="ss-search"
            value={query}
            placeholder="Type to search…"
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
          />

          <div className="ss-list" ref={listRef} role="listbox">
            {allowEmpty && !query && (
              <button
                type="button"
                className={`ss-option ${!value ? 'is-selected' : ''}`}
                onClick={() => pick(null)}
              >
                <span className="muted">{emptyLabel}</span>
              </button>
            )}

            {matches.length === 0 ? (
              <div className="ss-empty">No match for “{query}”</div>
            ) : (
              matches.map((o, i) => {
                const v = String(getValue(o));
                return (
                  <button
                    type="button"
                    key={v}
                    role="option"
                    aria-selected={v === String(value)}
                    data-active={i === active}
                    className={`ss-option ${i === active ? 'is-active' : ''} ${v === String(value) ? 'is-selected' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(o)}
                  >
                    <span>{getLabel(o)}</span>
                    {getMeta && getMeta(o) && (
                      <span className="ss-meta">{getMeta(o)}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {options.length > 12 && (
            <div className="ss-foot">
              {matches.length} of {options.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
