import { useState } from 'react';
import api, { errorMessage, CAPS } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import usePagedList from '../hooks/usePagedList.js';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import { money, number, dateTime } from '../utils/format.js';

/**
 * Estimates are the shop's daily document. Nothing here has touched stock or
 * any ledger — conversion is the moment that happens.
 */
export default function Estimates() {
  const { can } = useAuth();
  const list = usePagedList('/sales', { params: { estimates: 'true' } });
  const [detail, setDetail] = useState(null);
  const [convert, setConvert] = useState(null);
  const [cash, setCash] = useState('');
  const [method, setMethod] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const doConvert = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const { data } = await api.post(`/sales/${convert._id}/convert`, {
        cashReceived: Number(cash || 0), paymentMethod: method,
      });
      setConvert(null); setCash('');
      list.reload();
      window.alert(data.message);
    } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Estimates</h1>
          <div className="sub">Quotes that have not moved stock — converting one turns it into an invoice</div>
        </div>
      </div>

      <ErrorNote message={list.error} onRetry={list.reload} />

      <div className="card">
        <div className="card-head">
          <input className="search" placeholder="Search by estimate number…" value={list.search}
                 onChange={(e) => list.setSearch(e.target.value)} style={{ maxWidth: 320 }} />
        </div>

        {list.loading ? <Loading /> : list.items.length === 0 ? (
          <Empty icon="◷" title="No estimates" hint="Create a sale with 'Save as estimate' to hold stock back." />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Estimate</th><th>Customer</th><th className="num">Items</th><th className="num">Qty</th>
                      <th className="num">Total</th><th>Created</th><th /></tr>
                </thead>
                <tbody>
                  {list.items.map((s) => (
                    <tr key={s._id}>
                      <td className="mono">{s.invoiceNo}</td>
                      <td>{s.customer?.name || s.customerName}</td>
                      <td className="num muted">{s.items?.length || 0}</td>
                      <td className="num muted">{number(s.totalQuantity)}</td>
                      <td className="num strong">{money(s.totalAmount)}</td>
                      <td className="muted small nowrap">{dateTime(s.createdAt)}</td>
                      <td className="actions-cell">
                        <button className="btn btn-ghost btn-sm" onClick={() => setDetail(s)}>View</button>{' '}
                        {can(CAPS.SALE_CREATE) && s.status !== 'cancelled' && (
                          <button className="btn btn-primary btn-sm"
                                  onClick={() => { setConvert(s); setCash(''); setError(''); }}>
                            Convert
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

      <Modal open={Boolean(detail)} title={`Estimate ${detail?.invoiceNo || ''}`} onClose={() => setDetail(null)} wide
             footer={<button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>}>
        {detail && (
          <>
            <div className="alert alert-info">
              <span>ℹ</span>
              <div>Nothing on this estimate has been deducted from stock.</div>
            </div>
            <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
              <table>
                <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {detail.items?.map((i, idx) => (
                    <tr key={idx}>
                      <td><div className="strong">{i.name}</div><div className="small muted mono">{i.sku}</div></td>
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
                <div className="flex" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Total # of items</span><span>{detail.items?.length} · {number(detail.totalQuantity)} units</span>
                </div>
                <div className="flex mt-2" style={{ justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <span className="strong">Gross amount</span>
                  <span className="strong" style={{ fontSize: 18 }}>{money(detail.totalAmount)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={Boolean(convert)}
        title={`Convert ${convert?.invoiceNo || ''} to an invoice`}
        onClose={() => setConvert(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConvert(null)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={doConvert} disabled={saving}>
              {saving ? <><span className="spinner" /> Converting…</> : 'Convert and deduct stock'}
            </button>
          </>
        }
      >
        <form onSubmit={doConvert}>
          {error && <div className="alert alert-error"><span>⚠</span><div>{error}</div></div>}
          <div className="alert alert-warning">
            <span>⚠</span>
            <div>
              This deducts <strong>{number(convert?.totalQuantity)} units</strong> from stock and posts
              {convert?.customer ? ' the customer ledger' : ' the sale'}. Costs are re-read at today's figures.
            </div>
          </div>
          <div className="field">
            <label>Cash received now</label>
            <input type="number" step="0.01" min="0" value={cash} onChange={(e) => setCash(e.target.value)}
                   placeholder={String(convert?.totalAmount ?? 0)} autoFocus />
            <div className="hint">Leave blank for a fully credit sale. Total is {money(convert?.totalAmount)}.</div>
          </div>
          <div className="field">
            <label>Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option><option value="bank">Bank transfer</option>
              <option value="card">Card</option><option value="wallet">Mobile wallet</option>
            </select>
          </div>
        </form>
      </Modal>
    </>
  );
}
