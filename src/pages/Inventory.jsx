import { useEffect, useState } from 'react';
import api, { errorMessage, CAPS } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ReadOnly from '../components/ReadOnly.jsx';
import usePagedList from '../hooks/usePagedList.js';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import { money, number, dateTime } from '../utils/format.js';
import { CostUnlockButton } from '../components/CostUnlock.jsx';
import useCostRefresh from '../hooks/useCostRefresh.js';

export default function Inventory() {
  const list = usePagedList('/inventory');
  // Stock value is derived from purchase cost, so it lives behind the same
  // step-up as the cost itself.
  const { canUnlock, unlocked } = useCostRefresh(list.reload);

  // Stock is the shopkeeper's to move (§39). The Super Admin watches it.
  const { can } = useAuth();
  const canAdjust = can(CAPS.INVENTORY_ADJUST);
  const [tab, setTab] = useState('stock');
  const [lowStock, setLowStock] = useState([]);
  const [txns, setTxns] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [adjustFor, setAdjustFor] = useState(null);
  const [change, setChange] = useState('');
  const [moveType, setMoveType] = useState('adjustment');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadLowStock = () =>
    api.get('/inventory/low-stock').then(({ data }) => setLowStock(data.data || [])).catch(() => {});

  useEffect(() => {
    loadLowStock();
  }, []);

  useEffect(() => {
    if (tab !== 'movements') return;
    setTxnLoading(true);
    api
      .get('/inventory/transactions?limit=50')
      .then(({ data }) => setTxns(data.data || []))
      .catch(() => setTxns([]))
      .finally(() => setTxnLoading(false));
  }, [tab]);

  const openAdjust = (p) => {
    setAdjustFor(p);
    setChange('');
    setNotes('');
    setFormError('');
  };

  const submitAdjust = async (e) => {
    e.preventDefault();
    const delta = Number(change);
    if (!delta) {
      setFormError('Enter a non-zero quantity (use a negative number to reduce stock).');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await api.post('/inventory/adjust', {
        productId: adjustFor._id,
        type: moveType,
        // damage/defective always remove stock, so send the magnitude
        quantity: ['damage', 'defective'].includes(moveType) ? Math.abs(delta) : delta,
        notes,
      });
      setAdjustFor(null);
      list.reload();
      loadLowStock();
      if (tab === 'movements') setTab('stock');
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const TabBtn = ({ id, children, count }) => (
    <button
      className={`btn btn-sm ${tab === id ? 'btn-primary' : 'btn-ghost'}`}
      onClick={() => setTab(id)}
    >
      {children}
      {count > 0 && <span className="badge badge-red" style={{ marginLeft: 6 }}>{count}</span>}
    </button>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inventory</h1>
          <div className="sub">Stock levels, low-stock alerts and every movement</div>
        </div>
        <div className="page-head-actions">
          <TabBtn id="stock">Stock levels</TabBtn>
          <TabBtn id="low" count={lowStock.length}>Low stock</TabBtn>
          <TabBtn id="movements">Movements</TabBtn>
        </div>
      </div>

      {lowStock.length > 0 && tab !== 'low' && (
        <div className="alert alert-warning">
          <span>⚠</span>
          <div style={{ flex: 1 }}>
            <strong>{lowStock.length} product{lowStock.length === 1 ? '' : 's'}</strong> at or below the minimum
            stock level.
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setTab('low')}>
            Review
          </button>
        </div>
      )}

      {tab === 'stock' && (
        <>
          {!canAdjust && <ReadOnly what="Stock levels" />}

          <ErrorNote message={list.error} onRetry={list.reload} />
          <div className="card">
            <div className="card-head">
              <input
                className="search"
                placeholder="Search stock by name or SKU…"
                value={list.search}
                onChange={(e) => list.setSearch(e.target.value)}
                style={{ maxWidth: 340 }}
              />
            </div>

            {list.loading ? (
              <Loading />
            ) : list.items.length === 0 ? (
              <Empty icon="▦" title="No stock records" hint="Add products to start tracking stock." />
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Product</th>
                        <th className="num">In stock</th>
                        <th className="num">Minimum</th>
                        {canUnlock && (
                          <th className="num">
                            {unlocked ? 'Stock value' : <CostUnlockButton compact />}
                          </th>
                        )}
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {list.items.map((p) => {
                        const low = p.quantity <= p.minimumStock;
                        return (
                          <tr key={p._id}>
                            <td className="mono">{p.sku}</td>
                            <td className="strong">{p.name}</td>
                            <td className="num strong">{number(p.quantity)} {p.unit}</td>
                            <td className="num muted">{number(p.minimumStock)}</td>
                            {canUnlock && (
                              <td className="num muted">
                                {unlocked ? money(p.quantity * (p.purchasePrice || 0)) : '••••'}
                              </td>
                            )}
                            <td>
                              <span className={`badge ${low ? 'badge-red' : 'badge-green'}`}>
                                {low ? 'Reorder' : 'Healthy'}
                              </span>
                            </td>
                            <td className="actions-cell">
                              {canAdjust && (
                                <button className="btn btn-ghost btn-sm" onClick={() => openAdjust(p)}>
                                  Adjust
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination pagination={list.pagination} onPage={list.setPage} />
              </>
            )}
          </div>
        </>
      )}

      {tab === 'low' && (
        <div className="card">
          <div className="card-head">
            <h2>Low stock — reorder soon</h2>
          </div>
          {lowStock.length === 0 ? (
            <Empty icon="✓" title="Everything is above minimum" hint="No products need reordering right now." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th className="num">In stock</th>
                    <th className="num">Minimum</th>
                    <th className="num">Shortfall</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((p) => (
                    <tr key={p._id}>
                      <td className="mono">{p.sku}</td>
                      <td className="strong">{p.name}</td>
                      <td className="num">
                        <span className="badge badge-red">{number(p.quantity)} {p.unit}</span>
                      </td>
                      <td className="num muted">{number(p.minimumStock)}</td>
                      <td className="num strong">{number(Math.max(0, p.minimumStock - p.quantity))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'movements' && (
        <div className="card">
          <div className="card-head">
            <h2>Recent stock movements</h2>
          </div>
          {txnLoading ? (
            <Loading />
          ) : txns.length === 0 ? (
            <Empty icon="⇅" title="No movements recorded yet" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Product</th>
                    <th>Type</th>
                    <th className="num">Change</th>
                    <th className="num">After</th>
                    <th>Reference</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t) => (
                    <tr key={t._id}>
                      <td className="muted small nowrap">{dateTime(t.createdAt)}</td>
                      <td>
                        <div className="strong">{t.product?.name || '—'}</div>
                        <div className="small muted mono">{t.product?.sku}</div>
                      </td>
                      <td>
                        <span className="badge badge-gray">{t.type}</span>
                      </td>
                      <td className="num strong" style={{ color: t.quantityChange < 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {t.quantityChange > 0 ? '+' : ''}{number(t.quantityChange)}
                      </td>
                      <td className="num muted">{number(t.quantityAfter)}</td>
                      <td className="mono small">{t.reference || '—'}</td>
                      <td className="muted small">
                        {t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}` : 'System'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        open={Boolean(adjustFor)}
        title={`Adjust stock — ${adjustFor?.name || ''}`}
        onClose={() => setAdjustFor(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setAdjustFor(null)} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submitAdjust} disabled={saving}>
              {saving ? <><span className="spinner" /> Saving…</> : 'Apply adjustment'}
            </button>
          </>
        }
      >
        <form onSubmit={submitAdjust}>
          {formError && (
            <div className="alert alert-error">
              <span>⚠</span>
              <div>{formError}</div>
            </div>
          )}

          <div className="alert alert-info">
            <span>ℹ</span>
            <div>
              Current stock: <strong>{number(adjustFor?.quantity)} {adjustFor?.unit}</strong>
              {change !== '' && !Number.isNaN(Number(change)) && (
                <> → after adjustment: <strong>{number((adjustFor?.quantity || 0) + Number(change))}</strong></>
              )}
            </div>
          </div>

          <div className="field">
            <label>Movement type</label>
            <select value={moveType} onChange={(e) => setMoveType(e.target.value)}>
              <option value="adjustment">Adjustment — stock count correction</option>
              <option value="damage">Damage — broken in the shop</option>
              <option value="defective">Defective — faulty from supplier</option>
              <option value="sales_return">Sales return — customer brought it back</option>
              <option value="transfer">Transfer</option>
            </select>
            <div className="hint">
              {['damage', 'defective'].includes(moveType)
                ? 'Enter how many leave stock — the type already means they are removed.'
                : 'Positive adds, negative removes.'}
            </div>
          </div>

          <div className="field">
            <label>Quantity *</label>
            <input
              type="number"
              value={change}
              onChange={(e) => setChange(e.target.value)}
              placeholder="e.g. 10 to add, -5 to remove"
              autoFocus
            />
            <div className="hint">Use a positive number to add stock, negative to remove it.</div>
          </div>

          <div className="field">
            <label>Reason *</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Damaged units, stock count correction, returned to supplier…"
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
