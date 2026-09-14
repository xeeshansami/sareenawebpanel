import { useEffect, useMemo, useState } from 'react';
import api, { errorMessage, CAPS } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ReadOnly from '../components/ReadOnly.jsx';
import usePagedList from '../hooks/usePagedList.js';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import { money, number, dateTime, statusBadge } from '../utils/format.js';
import { CostUnlockButton } from '../components/CostUnlock.jsx';
import useCostRefresh from '../hooks/useCostRefresh.js';

function NewPurchaseForm({ products, suppliers, onDone, onCancel }) {
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState([]);
  const [picker, setPicker] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paid, setPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addLine = (productId) => {
    if (!productId) return;
    const p = products.find((x) => x._id === productId);
    if (!p) return;
    setLines((prev) => {
      if (prev.some((l) => l.productId === productId)) {
        return prev.map((l) => (l.productId === productId ? { ...l, quantity: Number(l.quantity) + 1 } : l));
      }
      return [...prev, { productId, name: p.name, sku: p.sku, quantity: 1, unitCost: p.purchasePrice || 0 }];
    });
    setPicker('');
  };

  const updateLine = (productId, patch) =>
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  const removeLine = (productId) => setLines((prev) => prev.filter((l) => l.productId !== productId));

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitCost || 0), 0),
    [lines]
  );
  const total = Math.max(0, subtotal - Number(discount || 0) + Number(tax || 0));
  const paidNum = paid === '' ? 0 : Number(paid);
  const due = Math.max(0, total - paidNum);

  const submit = async (e) => {
    e.preventDefault();
    if (lines.length === 0) {
      setError('Add at least one product to the purchase order.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/purchases', {
        supplierId: supplierId || null,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost),
        })),
        discountAmount: Number(discount || 0),
        taxAmount: Number(tax || 0),
        paidAmount: paidNum,
        notes,
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      {error && (
        <div className="alert alert-error">
          <span>⚠</span>
          <div>{error}</div>
        </div>
      )}

      <div className="alert alert-info">
        <span>ℹ</span>
        <div>Receiving a purchase adds the quantities to stock and updates each product&rsquo;s cost price.</div>
      </div>

      <div className="form-row">
        <div className="field">
          <label>Supplier</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— no supplier —</option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Add product</label>
          <select value={picker} onChange={(e) => addLine(e.target.value)}>
            <option value="">Select a product to add…</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
                {p.purchasePrice === undefined ? '' : ` — last cost ${money(p.purchasePrice)}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="empty" style={{ padding: 28, border: '1px dashed var(--border-strong)', borderRadius: 8 }}>
          <div className="empty-icon">📦</div>
          <div className="strong">No items yet</div>
          <div className="small mt-2">Pick a product above to build the order.</div>
        </div>
      ) : (
        <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th className="num" style={{ width: 100 }}>Qty</th>
                <th className="num" style={{ width: 130 }}>Unit cost</th>
                <th className="num">Line total</th>
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.productId}>
                  <td>
                    <div className="strong">{l.name}</div>
                    <div className="small muted mono">{l.sku}</div>
                  </td>
                  <td className="num">
                    <input
                      type="number" min="1" value={l.quantity}
                      onChange={(e) => updateLine(l.productId, { quantity: e.target.value })}
                      style={{ textAlign: 'right', padding: '5px 8px' }}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number" step="0.01" min="0" value={l.unitCost}
                      onChange={(e) => updateLine(l.productId, { unitCost: e.target.value })}
                      style={{ textAlign: 'right', padding: '5px 8px' }}
                    />
                  </td>
                  <td className="num strong">{money(Number(l.quantity || 0) * Number(l.unitCost || 0))}</td>
                  <td className="actions-cell">
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => removeLine(l.productId)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="form-row mt-3">
        <div className="field">
          <label>Discount</label>
          <input type="number" step="0.01" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <div className="field">
          <label>Tax</label>
          <input type="number" step="0.01" min="0" value={tax} onChange={(e) => setTax(e.target.value)} />
        </div>
        <div className="field">
          <label>Amount paid</label>
          <input
            type="number" step="0.01" min="0" value={paid}
            onChange={(e) => setPaid(e.target.value)} placeholder={total.toFixed(2)}
          />
        </div>
      </div>

      <div className="card" style={{ background: 'var(--surface-2)' }}>
        <div className="card-body">
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <span className="muted">Subtotal</span>
            <span className="strong">{money(subtotal)}</span>
          </div>
          <div className="flex mt-2" style={{ justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <span className="strong">Total</span>
            <span className="strong" style={{ fontSize: 18 }}>{money(total)}</span>
          </div>
          <div className="flex mt-2" style={{ justifyContent: 'space-between' }}>
            <span className="muted">Paid / Due</span>
            <span>
              {money(paidNum)} /{' '}
              <span className="strong" style={{ color: due > 0 ? 'var(--warning)' : 'var(--success)' }}>{money(due)}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="field mt-3">
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Supplier invoice number, delivery note…" />
      </div>

      <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving || lines.length === 0}>
          {saving ? <><span className="spinner" /> Recording…</> : `Receive purchase — ${money(total)}`}
        </button>
      </div>
    </form>
  );
}

export default function Purchases() {
  const { can } = useAuth();
  const canCreate = can(CAPS.PURCHASE_CREATE);
  const canPay = can(CAPS.PURCHASE_PAY);
  const list = usePagedList('/purchases');
  // A purchase is a cost record, so the API withholds its amounts until the
  // step-up is held. Receiving stock still works while locked — typing a rate
  // is a write, not a read.
  const { canUnlock, unlocked } = useCostRefresh(list.reload);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const loadRefs = () => {
    Promise.all([
      api.get('/products', { params: { limit: 200, isActive: true } }),
      api.get('/suppliers', { params: { limit: 200 } }),
    ])
      .then(([p, s]) => {
        setProducts(p.data.data || []);
        setSuppliers(s.data.data || []);
      })
      .catch(() => {});
  };

  useEffect(() => { loadRefs(); }, []);

  const submitPayment = async (e) => {
    e.preventDefault();
    const amount = Number(payAmount);
    if (!amount || amount <= 0) { setPayError('Enter an amount greater than zero.'); return; }
    setPaying(true);
    setPayError('');
    try {
      await api.post(`/purchases/${payFor._id}/payment`, { amount });
      setPayFor(null);
      list.reload();
    } catch (err) {
      setPayError(errorMessage(err));
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Purchases</h1>
          <div className="sub">
            {canUnlock && !unlocked
              ? 'Amounts are locked — confirm your password to see supplier rates'
              : 'Stock coming in from suppliers, and what you still owe'}
          </div>
        </div>
        <div className="page-head-actions">
          {canUnlock && !unlocked && <CostUnlockButton label="Show amounts" />}
          {canCreate && (
            <button className="btn btn-primary" onClick={() => { loadRefs(); setNewOpen(true); }}>
              + New purchase
            </button>
          )}
        </div>
      </div>

      {!canCreate && !canPay && <ReadOnly what="Purchases" />}

      <ErrorNote message={list.error} onRetry={list.reload} />

      <div className="card">
        <div className="card-head">
          <input
            className="search" placeholder="Search by reference number…"
            value={list.search} onChange={(e) => list.setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>

        {list.loading ? (
          <Loading />
        ) : list.items.length === 0 ? (
          <Empty icon="↘" title="No purchases recorded" hint="Record a purchase to bring stock in." />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Supplier</th>
                    <th className="num">Items</th>
                    <th className="num">Total</th>
                    <th className="num">Paid</th>
                    <th className="num">Due</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((p) => (
                    <tr key={p._id}>
                      <td className="mono">{p.referenceNo}</td>
                      <td>{p.supplier?.name || p.supplierName || '—'}</td>
                      <td className="num muted">{p.items?.length || 0}</td>
                      <td className="num strong">{money(p.totalAmount)}</td>
                      <td className="num muted">{money(p.paidAmount)}</td>
                      <td className="num" style={{ color: p.dueAmount > 0 ? 'var(--warning)' : undefined }}>
                        {p.dueAmount > 0 ? money(p.dueAmount) : '—'}
                      </td>
                      <td><span className={`badge ${statusBadge(p.status)}`}>{p.status}</span></td>
                      <td className="muted small nowrap">{dateTime(p.createdAt)}</td>
                      <td className="actions-cell">
                        <button className="btn btn-ghost btn-sm" onClick={() => setDetail(p)}>View</button>{' '}
                        {canPay && p.dueAmount > 0 && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setPayFor(p); setPayAmount(String(p.dueAmount)); setPayError(''); }}
                          >
                            Pay
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={list.pagination} onPage={list.setPage} />
          </>
        )}
      </div>

      <Modal open={newOpen} title="New purchase" onClose={() => setNewOpen(false)} wide>
        <NewPurchaseForm
          products={products}
          suppliers={suppliers}
          onCancel={() => setNewOpen(false)}
          onDone={() => { setNewOpen(false); list.reload(); loadRefs(); }}
        />
      </Modal>

      <Modal
        open={Boolean(detail)}
        title={`Purchase ${detail?.referenceNo || ''}`}
        onClose={() => setDetail(null)}
        wide
        footer={<button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>}
      >
        {detail && (
          <>
            <div className="form-row mb-3">
              <div>
                <div className="stat-label">Supplier</div>
                <div className="strong">{detail.supplier?.name || detail.supplierName || '—'}</div>
              </div>
              <div>
                <div className="stat-label">Date</div>
                <div className="strong">{dateTime(detail.createdAt)}</div>
              </div>
              <div>
                <div className="stat-label">Status</div>
                <div><span className={`badge ${statusBadge(detail.status)}`}>{detail.status}</span></div>
              </div>
            </div>

            <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">Qty</th>
                    <th className="num">Unit cost</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items?.map((i, idx) => (
                    <tr key={idx}>
                      <td>
                        <div className="strong">{i.name}</div>
                        <div className="small muted mono">{i.sku}</div>
                      </td>
                      <td className="num">{number(i.quantity)}</td>
                      <td className="num muted">{money(i.unitCost)}</td>
                      <td className="num strong">{money(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card mt-3" style={{ background: 'var(--surface-2)' }}>
              <div className="card-body">
                <div className="flex" style={{ justifyContent: 'space-between' }}>
                  <span className="strong">Total</span><span className="strong">{money(detail.totalAmount)}</span>
                </div>
                <div className="flex mt-2" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Paid / Due</span>
                  <span>{money(detail.paidAmount)} / {money(detail.dueAmount)}</span>
                </div>
              </div>
            </div>

            {detail.notes && (
              <div className="mt-3">
                <div className="stat-label">Notes</div>
                <div className="muted">{detail.notes}</div>
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal
        open={Boolean(payFor)}
        title={`Pay supplier — ${payFor?.referenceNo || ''}`}
        onClose={() => setPayFor(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setPayFor(null)} disabled={paying}>Cancel</button>
            <button className="btn btn-primary" onClick={submitPayment} disabled={paying}>
              {paying ? <><span className="spinner" /> Saving…</> : 'Record payment'}
            </button>
          </>
        }
      >
        <form onSubmit={submitPayment}>
          {payError && <div className="alert alert-error"><span>⚠</span><div>{payError}</div></div>}
          <div className="alert alert-info">
            <span>ℹ</span>
            <div>Outstanding on this order: <strong>{money(payFor?.dueAmount)}</strong></div>
          </div>
          <div className="field">
            <label>Amount *</label>
            <input
              type="number" step="0.01" min="0" max={payFor?.dueAmount}
              value={payAmount} onChange={(e) => setPayAmount(e.target.value)} autoFocus
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
