import { useState } from 'react';
import api, { errorMessage, CAPS } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Loading, ErrorNote } from '../components/States.jsx';
import { money, number } from '../utils/format.js';

/**
 * Import a supplier invoice into stock.
 *
 * Two steps on purpose. The upload only *reads* the PDF and reports what it
 * found; nothing reaches stock until Receive is pressed. Extraction is a guess
 * — a name truncated in the source document, a rate misread — and stock is the
 * number the rest of the system exists to keep honest. A wrong line caught
 * here costs a correction; the same line committed silently turns up weeks
 * later at a stock count with no way to tell which import was wrong.
 *
 * Photographing a paper invoice lives in the phone app, where the camera is
 * and where recognition runs on-device. Here the input is the PDF the
 * supplier sent, which has an exact text layer and needs no recognition.
 */
export default function Imports() {
  const { can } = useAuth();
  const canImport = can(CAPS.OCR_USE);
  const canReceive = can(CAPS.PURCHASE_CREATE);

  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [edits, setEdits] = useState({});      // sno -> { quantity, unitCost }
  const [skipped, setSkipped] = useState({});  // sno -> true

  const valueFor = (line, field) => {
    const edit = edits[line.sno]?.[field];
    return edit === undefined || edit === '' ? line[field] : Number(edit);
  };

  const upload = async (file) => {
    if (!file) return;
    setBusy('Reading the PDF…');
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/imports/preview', form);
      setPreview(data.data);
      setEdits({});
      setSkipped({});
    } catch (err) {
      setError(errorMessage(err));
      setPreview(null);
    } finally {
      setBusy('');
    }
  };

  const receive = async () => {
    const lines = [];
    for (const l of preview.lines) {
      if (skipped[l.sno]) continue;
      const entry = { quantity: valueFor(l, 'quantity'), unitCost: valueFor(l, 'unitCost') };
      if (l.match) {
        entry.productId = l.match.productId;
      } else if (l.suggestion?.sku) {
        entry.create = {
          sku: l.suggestion.sku,
          name: l.suggestion.name,
          brandId: l.suggestion.brandId || null,
          categoryId: l.suggestion.categoryId || null,
          technology: l.suggestion.technology || '',
          salePrice: 0,
        };
      } else {
        continue; // nothing safe to create
      }
      lines.push(entry);
    }

    if (!lines.length) { setError('Every line is skipped — nothing to receive.'); return; }
    if (!window.confirm(
      `Receive ${lines.length} line${lines.length === 1 ? '' : 's'} into stock?\n\n`
      + 'This creates a purchase, raises stock and re-blends your cost prices.'
    )) return;

    setBusy('Receiving…');
    setError('');
    try {
      const { data } = await api.post('/imports/commit', { source: preview.source, lines });
      window.alert(data.message);
      setPreview(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  if (!canImport) {
    return (
      <div className="page-head">
        <h1>Import invoice</h1>
        <p className="muted">Importing invoices needs the “ocr.use” permission.</p>
      </div>
    );
  }

  const s = preview?.summary;
  const keeping = preview ? preview.lines.filter((l) => !skipped[l.sno]).length : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Import invoice</h1>
          <p className="muted">
            Upload the PDF your supplier sent. You will see every line before anything reaches stock.
            To photograph a paper invoice, use the phone app.
          </p>
        </div>
        {preview && (
          <button className="btn btn-ghost" onClick={() => setPreview(null)} disabled={!!busy}>
            Start over
          </button>
        )}
      </div>

      {error && <ErrorNote message={error} />}
      {busy && <Loading label={busy} />}

      {!preview && !busy && (
        <div className="card" style={{ padding: 24 }}>
          <label className="field">
            <span>Supplier invoice (PDF)</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </label>
          <p className="small muted" style={{ marginTop: 12 }}>
            A digital invoice carries an exact text layer, so the figures are read rather than
            recognised. A scanned image inside a PDF has no text to read — photograph it in the
            phone app instead.
          </p>
        </div>
      )}

      {preview && !busy && (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div className="strong">
              {number(s.lines)} lines · {number(s.totalQuantity)} units · {money(s.totalAmount)}
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              <span className="badge badge-green">{s.matched} already in stock</span>{' '}
              {s.newProducts > 0 && <span className="badge badge-blue">{s.newProducts} new products</span>}{' '}
              {s.uncertain > 0 && <span className="badge badge-red">{s.uncertain} uncertain</span>}
            </div>
            {preview.warnings?.map((w) => (
              <div key={w} className="small muted" style={{ marginTop: 6 }}>⚠ {w}</div>
            ))}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>Will do</th>
                  <th className="num">Quantity</th>
                  <th className="num">Rate</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((l) => (
                  <tr key={l.sno} style={skipped[l.sno] ? { opacity: 0.45 } : undefined}>
                    <td className="mono">{l.sno}</td>
                    <td>
                      <div className="strong">{l.name}</div>
                      {l.brandLabel && <div className="small muted">{l.brandLabel}</div>}
                    </td>
                    <td className="small">
                      {l.match ? (
                        <>
                          <span className="badge badge-green">stock</span>{' '}
                          {l.match.sku} · {number(l.match.currentQuantity)} →{' '}
                          {number(Number(l.match.currentQuantity) + valueFor(l, 'quantity'))}
                          {l.match.confidence === 'likely' && (
                            <div className="small muted">matched on model — check this one</div>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="badge badge-blue">new</span>{' '}
                          {l.suggestion?.sku || <span className="muted">no SKU — will be skipped</span>}
                          {l.suggestion?.brandChoices?.length > 0 && (
                            <div className="small muted">
                              brand could be {l.suggestion.brandChoices.join(' or ')} — set it after import
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="num">
                      <input
                        type="number" min="1" style={{ width: 80 }}
                        value={edits[l.sno]?.quantity ?? l.quantity}
                        onChange={(e) => setEdits((p) => ({
                          ...p, [l.sno]: { ...p[l.sno], quantity: e.target.value },
                        }))}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number" min="0" step="0.01" style={{ width: 100 }}
                        value={edits[l.sno]?.unitCost ?? l.unitCost}
                        onChange={(e) => setEdits((p) => ({
                          ...p, [l.sno]: { ...p[l.sno], unitCost: e.target.value },
                        }))}
                      />
                    </td>
                    <td className="actions-cell">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setSkipped((p) => ({ ...p, [l.sno]: !p[l.sno] }))}
                      >
                        {skipped[l.sno] ? 'Include' : 'Skip'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={receive} disabled={!canReceive || !keeping}>
              Receive {keeping} line{keeping === 1 ? '' : 's'} into stock
            </button>
            {!canReceive && (
              <span className="small muted" style={{ marginLeft: 10 }}>
                Receiving needs the “purchase.create” permission.
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
}
