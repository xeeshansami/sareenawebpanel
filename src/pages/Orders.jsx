import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage, CAPS } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import usePagedList from '../hooks/usePagedList.js';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import { money, number, dateTime } from '../utils/format.js';

/**
 * Marketplace orders, from the shop's side (§26).
 *
 * The state machine lives on the server: each order arrives carrying its own
 * `nextStatuses`, and the buttons are generated from that list. So the panel
 * cannot offer a move the API would refuse, and adding a state later needs no
 * change here.
 */
const STATUS_TONE = {
  pending: 'badge-orange',
  confirmed: 'badge-green',
  processing: 'badge-green',
  ready: 'badge-green',
  completed: 'badge-gray',
  rejected: 'badge-red',
  cancelled: 'badge-gray',
};

const ACTION_LABEL = {
  confirmed: 'Accept',
  rejected: 'Decline',
  processing: 'Start preparing',
  ready: 'Mark ready',
  cancelled: 'Cancel',
};

const FILTERS = [
  ['open', 'Needs attention'],
  ['pending', 'New'],
  ['confirmed', 'Accepted'],
  ['processing', 'Preparing'],
  ['ready', 'Ready'],
  ['completed', 'Completed'],
  ['', 'All'],
];

export default function Orders() {
  const { can, viewingAllShops } = useAuth();
  const [filter, setFilter] = useState('open');

  const params = filter === 'open' ? { open: 'true' } : filter ? { status: filter } : {};
  const list = usePagedList('/orders', { params });

  const [summary, setSummary] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [fulfilling, setFulfilling] = useState(null);
  const [cashReceived, setCashReceived] = useState('');
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  const canFulfil = can(CAPS.ORDER_FULFIL);

  const loadSummary = useCallback(() => {
    api.get('/orders/summary')
      .then(({ data }) => setSummary(data.data))
      .catch(() => setSummary(null));
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary, list.items]);

  const refresh = () => { list.reload(); loadSummary(); };

  const move = async (order, status) => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/orders/${order.id}/status`, { status });
      setDetail(data.data);
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post(`/orders/${rejecting.id}/status`, { status: 'rejected', reason });
      setRejecting(null);
      setReason('');
      setDetail(null);
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const fulfil = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/orders/${fulfilling.id}/fulfil`, {
        cashReceived: Number(cashReceived || 0),
      });
      setFulfilling(null);
      setCashReceived('');
      setDetail(null);
      refresh();
      window.alert(data.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (viewingAllShops) {
    return (
      <Empty
        icon="☷"
        title="Pick a shop first"
        hint="Orders belong to one shop — choose one from the switcher above."
      />
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Orders</h1>
          <div className="sub">
            Orders placed on the marketplace. Accepting one sets its stock aside;
            completing one writes the invoice.
          </div>
        </div>
      </div>

      {summary && (
        <div className="grid grid-4 mb-3">
          <div className="card stat">
            <div className="stat-row">
              <div className="stat-icon orange">☷</div>
              <div>
                <div className="stat-label">Needs attention</div>
                <div className="stat-value">{number(summary.open)}</div>
                <div className="stat-meta">{number(summary.pending)} not yet accepted</div>
              </div>
            </div>
          </div>
          <div className="card stat">
            <div className="stat-row">
              <div className="stat-icon">▦</div>
              <div>
                <div className="stat-label">Stock set aside</div>
                <div className="stat-value">{number(summary.reserved?.units)}</div>
                <div className="stat-meta">
                  across {number(summary.reserved?.products)} product{summary.reserved?.products === 1 ? '' : 's'}
                </div>
              </div>
            </div>
          </div>
          <div className="card stat">
            <div className="stat-row">
              <div className="stat-icon green">✓</div>
              <div>
                <div className="stat-label">Completed</div>
                <div className="stat-value">{number(summary.completed)}</div>
                <div className="stat-meta">invoiced and delivered</div>
              </div>
            </div>
          </div>
          <div className="card stat">
            <div className="stat-row">
              <div className="stat-icon">↗</div>
              <div>
                <div className="stat-label">Ready to hand over</div>
                <div className="stat-value">{number(summary.byStatus?.ready?.count)}</div>
                <div className="stat-meta">{money(summary.byStatus?.ready?.value)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ErrorNote message={list.error} onRetry={list.reload} />
      {error && <div className="alert alert-error"><span>⚠</span><div>{error}</div></div>}

      <div className="card">
        <div className="card-head">
          <div className="seg">
            {FILTERS.map(([key, label]) => (
              <button key={key || 'all'} aria-pressed={filter === key} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>
          <div className="actions">
            <input
              className="search" placeholder="Order number, name or phone…"
              value={list.search} onChange={(e) => list.setSearch(e.target.value)}
              style={{ maxWidth: 260 }}
            />
          </div>
        </div>

        {list.loading ? (
          <Loading />
        ) : list.items.length === 0 ? (
          <Empty
            icon="☷"
            title={filter === 'open' ? 'Nothing waiting on you' : 'No orders here'}
            hint={filter === 'open'
              ? 'New marketplace orders will appear here for you to accept.'
              : 'Try a different filter.'}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th><th>Customer</th><th className="num">Items</th>
                    <th className="num">Value</th><th>Status</th><th>Placed</th><th />
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((o) => (
                    <tr key={o.id}>
                      <td className="mono">{o.orderNo}</td>
                      <td>
                        <div className="strong">{o.contactName}</div>
                        <div className="small muted">{o.contactPhone || '—'}</div>
                      </td>
                      <td className="num muted">{number(o.itemCount)}</td>
                      <td className="num strong">{money(o.subtotal)}</td>
                      <td>
                        <span className={`badge ${STATUS_TONE[o.status] || 'badge-gray'}`}>{o.status}</span>
                        {o.stockReserved && <div className="small muted">stock set aside</div>}
                      </td>
                      <td className="muted small nowrap">{dateTime(o.placedAt)}</td>
                      <td className="actions-cell">
                        <button className="btn btn-ghost btn-sm" onClick={() => setDetail(o)}>Open</button>
                        {canFulfil && o.status === 'pending' && (
                          <>
                            {' '}
                            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => move(o, 'confirmed')}>
                              Accept
                            </button>
                          </>
                        )}
                        {canFulfil && o.status === 'ready' && (
                          <>
                            {' '}
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => { setFulfilling(o); setCashReceived(String(o.subtotal)); }}
                            >
                              Complete
                            </button>
                          </>
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

      {/* ── detail ── */}
      <Modal
        open={Boolean(detail)}
        title={detail ? `Order ${detail.orderNo}` : 'Order'}
        onClose={() => setDetail(null)}
        wide
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>
            {canFulfil && detail?.status === 'ready' && (
              <button
                className="btn btn-primary"
                onClick={() => { setFulfilling(detail); setCashReceived(String(detail.subtotal)); }}
              >
                Complete and invoice
              </button>
            )}
            {canFulfil && (detail?.nextStatuses || [])
              .filter((s) => s !== 'rejected' && s !== 'completed')
              .map((s) => (
                <button key={s} className="btn btn-primary" disabled={busy} onClick={() => move(detail, s)}>
                  {ACTION_LABEL[s] || s}
                </button>
              ))}
            {canFulfil && (detail?.nextStatuses || []).includes('rejected') && (
              <button
                className="btn btn-ghost"
                style={{ color: 'var(--danger)' }}
                onClick={() => { setRejecting(detail); setReason(''); }}
              >
                Decline
              </button>
            )}
          </>
        }
      >
        {detail && (
          <>
            <div className="form-row">
              <div>
                <div className="small muted">Status</div>
                <div className="strong">
                  <span className={`badge ${STATUS_TONE[detail.status]}`}>{detail.status}</span>
                </div>
              </div>
              <div>
                <div className="small muted">Placed</div>
                <div className="strong">{dateTime(detail.placedAt)}</div>
              </div>
              <div>
                <div className="small muted">Value</div>
                <div className="strong">{money(detail.subtotal)}</div>
              </div>
            </div>

            <div className="card mt-3" style={{ background: 'var(--surface-2)' }}>
              <div className="card-body">
                <div className="strong">{detail.contactName}</div>
                {detail.contactPhone && <div className="small">{detail.contactPhone}</div>}
                {detail.deliveryAddress && <div className="small muted">{detail.deliveryAddress}</div>}
                {detail.note && (
                  <div className="small mt-2"><strong>Note:</strong> {detail.note}</div>
                )}
              </div>
            </div>

            <div className="table-wrap mt-3">
              <table>
                <thead>
                  <tr><th>Part</th><th className="num">Price</th><th className="num">Qty</th><th className="num">Total</th></tr>
                </thead>
                <tbody>
                  {detail.items.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <div className="strong">{l.name}</div>
                        <div className="small muted mono">{l.sku}</div>
                      </td>
                      <td className="num">{money(l.salePrice)}</td>
                      <td className="num">{number(l.quantity)}</td>
                      <td className="num strong">{money(l.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {detail.saleId && (
              <div className="alert alert-success mt-3">
                <span>✓</span>
                <div>This order has been invoiced. It appears in Sales like any other invoice.</div>
              </div>
            )}

            {detail.status === 'pending' && (
              <div className="alert alert-info mt-3">
                <span>▦</span>
                <div>
                  Accepting this order sets its stock aside so it cannot be sold twice.
                  Nothing leaves your inventory until you complete it.
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── decline ── */}
      <Modal
        open={Boolean(rejecting)}
        title={`Decline order ${rejecting?.orderNo || ''}`}
        onClose={() => setRejecting(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setRejecting(null)} disabled={busy}>Keep it</button>
            <button className="btn btn-primary" style={{ background: 'var(--danger)' }} onClick={decline} disabled={busy}>
              {busy ? <><span className="spinner" /> Declining…</> : 'Decline order'}
            </button>
          </>
        }
      >
        <div className="field">
          <label>Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="Out of stock, wrong model, cannot deliver to that area…"
          />
          <div className="hint">The customer sees this, so a plain sentence helps them try elsewhere.</div>
        </div>
      </Modal>

      {/* ── complete ── */}
      <Modal
        open={Boolean(fulfilling)}
        title={`Complete order ${fulfilling?.orderNo || ''}`}
        onClose={() => setFulfilling(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFulfilling(null)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={fulfil} disabled={busy}>
              {busy ? <><span className="spinner" /> Completing…</> : 'Complete and create invoice'}
            </button>
          </>
        }
      >
        {fulfilling && (
          <>
            <div className="alert alert-info">
              <span>↗</span>
              <div>
                This writes a real invoice for {money(fulfilling.subtotal)}, deducts the stock, and
                adds the customer to your books. Anything unpaid becomes their outstanding balance,
                exactly like a counter sale on credit.
              </div>
            </div>
            <div className="field">
              <label>Cash received now</label>
              <input
                type="number" step="0.01" min="0"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
              />
              <div className="hint">
                Leave the full amount if they are paying in full. Enter less — or zero — to record
                the rest as udhaar.
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
