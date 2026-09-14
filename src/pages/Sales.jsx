import { useEffect, useMemo, useState } from 'react';
import api, { errorMessage, CAPS } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ReadOnly from '../components/ReadOnly.jsx';
import usePagedList from '../hooks/usePagedList.js';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import { money, number, dateTime, statusBadge } from '../utils/format.js';

function NewSaleForm({ products, customers, onDone, onCancel }) {
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState([]);
  const [picker, setPicker] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paid, setPaid] = useState('');
  const [cargo, setCargo] = useState(0);
  const [asEstimate, setAsEstimate] = useState(false);
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addLine = (productId) => {
    if (!productId) return;
    const p = products.find((x) => x._id === productId);
    if (!p) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      if (existing) {
        return prev.map((l) =>
          l.productId === productId ? { ...l, quantity: Math.min(l.quantity + 1, p.quantity) } : l
        );
      }
      return [...prev, { productId, name: p.name, sku: p.sku, stock: p.quantity, quantity: 1, unitPrice: p.salePrice }];
    });
    setPicker('');
  };

  const updateLine = (productId, patch) =>
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));

  const removeLine = (productId) => setLines((prev) => prev.filter((l) => l.productId !== productId));

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0),
    [lines]
  );
  const total = Math.max(0, subtotal - Number(discount || 0) + Number(tax || 0) + Number(cargo || 0));
  const paidNum = paid === '' ? 0 : Number(paid);
  const due = Math.max(0, total - paidNum);

  const submit = async (e) => {
    e.preventDefault();
    if (lines.length === 0) {
      setError('Add at least one product to the sale.');
      return;
    }
    const overStock = lines.find((l) => Number(l.quantity) > l.stock);
    if (overStock) {
      setError(`Only ${overStock.stock} in stock for ${overStock.name}.`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api.post('/sales', {
        customerId: customerId || null,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
        })),
        discountAmount: Number(discount || 0),
        taxAmount: Number(tax || 0),
        cargoAmount: Number(cargo || 0),
        cashReceived: paidNum,
        paymentMethod: method,
        notes,
        isEstimate: asEstimate,
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

      <div className="form-row">
        <div className="field">
          <label>Customer</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Walk-in customer (cash)</option>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}{c.phone ? ` — ${c.phone}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Add product</label>
          <select value={picker} onChange={(e) => addLine(e.target.value)}>
            <option value="">Select a product to add…</option>
            {products
              .filter((p) => p.quantity > 0)
              .map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} — {money(p.salePrice)} ({p.quantity} in stock)
                </option>
              ))}
          </select>
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="empty" style={{ padding: 28, border: '1px dashed var(--border-strong)', borderRadius: 8 }}>
          <div className="empty-icon">🛒</div>
          <div className="strong">No items yet</div>
          <div className="small mt-2">Pick a product above to build the invoice.</div>
        </div>
      ) : (
        <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th className="num" style={{ width: 100 }}>Qty</th>
                <th className="num" style={{ width: 130 }}>Unit price</th>
                <th className="num">Line total</th>
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.productId}>
                  <td>
                    <div className="strong">{l.name}</div>
                    <div className="small muted mono">{l.sku} · {l.stock} in stock</div>
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min="1"
                      max={l.stock}
                      value={l.quantity}
                      onChange={(e) => updateLine(l.productId, { quantity: e.target.value })}
                      style={{ textAlign: 'right', padding: '5px 8px' }}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={l.unitPrice}
                      onChange={(e) => updateLine(l.productId, { unitPrice: e.target.value })}
                      style={{ textAlign: 'right', padding: '5px 8px' }}
                    />
                  </td>
                  <td className="num strong">{money(Number(l.quantity || 0) * Number(l.unitPrice || 0))}</td>
                  <td className="actions-cell">
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => removeLine(l.productId)}>
                      ×
                    </button>
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
          <label>Cargo</label>
          <input type="number" step="0.01" min="0" value={cargo} onChange={(e) => setCargo(e.target.value)} />
        </div>
        <div className="field">
          <label>Cash received</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            placeholder={total.toFixed(2)}
          />
        </div>
        <div className="field">
          <label>Payment method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank">Bank transfer</option>
            <option value="wallet">Mobile wallet</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--surface-2)' }}>
        <div className="card-body">
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <span className="muted">Subtotal</span>
            <span className="strong">{money(subtotal)}</span>
          </div>
          <div className="flex mt-2" style={{ justifyContent: 'space-between' }}>
            <span className="muted">Discount / Tax</span>
            <span>− {money(discount || 0)} / + {money(tax || 0)}</span>
          </div>
          <div
            className="flex mt-2"
            style={{ justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)' }}
          >
            <span className="strong">Total</span>
            <span className="strong" style={{ fontSize: 18 }}>{money(total)}</span>
          </div>
          <div className="flex mt-2" style={{ justifyContent: 'space-between' }}>
            <span className="muted">Paid / Due</span>
            <span>
              {money(paidNum)} /{' '}
              <span className="strong" style={{ color: due > 0 ? 'var(--warning)' : 'var(--success)' }}>
                {money(due)}
              </span>
            </span>
          </div>
          {due > 0 && !customerId && (
            <div className="alert alert-warning mt-2" style={{ marginBottom: 0 }}>
              <span>⚠</span>
              <div>A partial payment without a customer cannot be tracked as a receivable. Pick a customer or collect the full amount.</div>
            </div>
          )}
        </div>
      </div>

      <div className="field mt-3">
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note on this invoice" />
      </div>

      <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <label className="flex items-center" style={{ fontWeight: 500, marginRight: 'auto' }}>
          <input type="checkbox" checked={asEstimate} onChange={(e) => setAsEstimate(e.target.checked)}
                 style={{ width: 'auto', marginRight: 6 }} />
          Save as estimate — no stock movement until converted
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving || lines.length === 0}>
          {saving ? <><span className="spinner" /> Saving…</>
            : asEstimate ? `Save estimate — ${money(total)}` : `Record sale — ${money(total)}`}
        </button>
      </div>
    </form>
  );
}

export default function Sales() {
  // Recording sales is the shopkeeper's work; the Super Admin reads them (§39).
  const { can } = useAuth();
  const canCreate = can(CAPS.SALE_CREATE);
  const canPay = can(CAPS.SALE_PAY);
  const [status, setStatus] = useState('');
  const list = usePagedList('/sales', { params: { estimates: 'false', ...(status ? { status } : {}) } });
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const loadRefs = () => {
    Promise.all([api.get('/products', { params: { limit: 200, isActive: true } }), api.get('/customers', { params: { limit: 200 } })])
      .then(([p, c]) => {
        setProducts(p.data.data || []);
        setCustomers(c.data.data || []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadRefs();
  }, []);

  const openNew = () => {
    loadRefs();
    setNewOpen(true);
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setPayError('Enter an amount greater than zero.');
      return;
    }
    setPaying(true);
    setPayError('');
    try {
      await api.post(`/sales/${payFor._id}/payment`, { amount, paymentMethod: payMethod });
      setPayFor(null);
      list.reload();
    } catch (err) {
      setPayError(errorMessage(err));
    } finally {
      setPaying(false);
    }
  };

  const cancelSale = async (sale) => {
    if (!window.confirm(`Cancel ${sale.invoiceNo}? Stock will be returned to inventory.`)) return;
    try {
      await api.post(`/sales/${sale._id}/cancel`);
      setDetail(null);
      list.reload();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Sales</h1>
          <div className="sub">Invoices, payments and receivables</div>
        </div>
        <div className="page-head-actions">
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 160 }}>
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partially paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {canCreate && (
            <button className="btn btn-primary" onClick={openNew}>+ New sale</button>
          )}
        </div>
      </div>

      {!canCreate && !canPay && <ReadOnly what="Invoices" />}

      <ErrorNote message={list.error} onRetry={list.reload} />

      <div className="card">
        <div className="card-head">
          <input
            className="search"
            placeholder="Search by invoice number…"
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>

        {list.loading ? (
          <Loading />
        ) : list.items.length === 0 ? (
          <Empty icon="↗" title="No sales recorded" hint="Record your first sale to see it here." />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
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
                  {list.items.map((s) => (
                    <tr key={s._id}>
                      <td className="mono">{s.invoiceNo}</td>
                      <td>{s.customer?.name || s.customerName}</td>
                      <td className="num muted">{s.items?.length || 0}</td>
                      <td className="num strong">{money(s.totalAmount)}</td>
                      <td className="num muted">{money(s.paidAmount)}</td>
                      <td className="num" style={{ color: s.dueAmount > 0 ? 'var(--warning)' : undefined }}>
                        {s.dueAmount > 0 ? money(s.dueAmount) : '—'}
                      </td>
                      <td>
                        <span className={`badge ${statusBadge(s.status)}`}>{s.status}</span>
                      </td>
                      <td className="muted small nowrap">{dateTime(s.createdAt)}</td>
                      <td className="actions-cell">
                        <button className="btn btn-ghost btn-sm" onClick={() => setDetail(s)}>
                          View
                        </button>{' '}
                        {canPay && s.dueAmount > 0 && s.status !== 'cancelled' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setPayFor(s);
                              setPayAmount(String(s.dueAmount));
                              setPayMethod('cash');
                              setPayError('');
                            }}
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

      <Modal open={newOpen} title="New sale" onClose={() => setNewOpen(false)} wide>
        <NewSaleForm
          products={products}
          customers={customers}
          onCancel={() => setNewOpen(false)}
          onDone={() => {
            setNewOpen(false);
            list.reload();
            loadRefs();
          }}
        />
      </Modal>

      <Modal
        open={Boolean(detail)}
        title={`Invoice ${detail?.invoiceNo || ''}`}
        onClose={() => setDetail(null)}
        wide
        footer={
          <>
            {detail?.status !== 'cancelled' && (
              <button className="btn btn-danger" onClick={() => cancelSale(detail)}>
                Cancel sale
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setDetail(null)}>
              Close
            </button>
          </>
        }
      >
        {detail && (
          <>
            <div className="form-row mb-3">
              <div>
                <div className="stat-label">Customer</div>
                <div className="strong">{detail.customer?.name || detail.customerName}</div>
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
                    <th className="num">Unit price</th>
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
                      <td className="num muted">{money(i.unitPrice)}</td>
                      <td className="num strong">{money(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card mt-3" style={{ background: 'var(--surface-2)' }}>
              <div className="card-body">
                {[
                  ['Subtotal', money(detail.subtotal)],
                  ['Discount', `− ${money(detail.discountAmount)}`],
                  ['Tax', `+ ${money(detail.taxAmount)}`],
                  ['Total', money(detail.totalAmount)],
                  ['Paid', money(detail.paidAmount)],
                  ['Due', money(detail.dueAmount)],
                ].map(([k, v], i) => (
                  <div
                    key={k}
                    className="flex"
                    style={{
                      justifyContent: 'space-between',
                      marginTop: i === 0 ? 0 : 8,
                      paddingTop: k === 'Total' ? 10 : 0,
                      borderTop: k === 'Total' ? '1px solid var(--border)' : 'none',
                      fontWeight: k === 'Total' ? 650 : 400,
                    }}
                  >
                    <span className={k === 'Total' ? 'strong' : 'muted'}>{k}</span>
                    <span className={k === 'Total' ? 'strong' : ''}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {detail.payments?.length > 0 && (
              <div className="mt-3">
                <h3 className="mb-2">Payment history</h3>
                {detail.payments.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 small" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span className="badge badge-gray">{p.method}</span>
                    <span className="strong">{money(p.amount)}</span>
                    <span className="muted" style={{ marginLeft: 'auto' }}>{dateTime(p.paidAt)}</span>
                  </div>
                ))}
              </div>
            )}

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
        title={`Record payment — ${payFor?.invoiceNo || ''}`}
        onClose={() => setPayFor(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setPayFor(null)} disabled={paying}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submitPayment} disabled={paying}>
              {paying ? <><span className="spinner" /> Saving…</> : 'Record payment'}
            </button>
          </>
        }
      >
        <form onSubmit={submitPayment}>
          {payError && (
            <div className="alert alert-error">
              <span>⚠</span>
              <div>{payError}</div>
            </div>
          )}
          <div className="alert alert-info">
            <span>ℹ</span>
            <div>
              Outstanding on this invoice: <strong>{money(payFor?.dueAmount)}</strong>
            </div>
          </div>
          <div className="field">
            <label>Amount *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={payFor?.dueAmount}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              autoFocus
            />
            <div className="hint">Anything above the outstanding balance is capped automatically.</div>
          </div>
          <div className="field">
            <label>Method</label>
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank">Bank transfer</option>
              <option value="wallet">Mobile wallet</option>
            </select>
          </div>
        </form>
      </Modal>
    </>
  );
}
