import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage, CAPS } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import { money, number } from '../utils/format.js';
import { CostUnlockButton } from '../components/CostUnlock.jsx';
import { useCostUnlock } from '../context/CostUnlockContext.jsx';

const Stat = ({ label, value, meta, icon, tone = '' }) => (
  <div className="card stat">
    <div className="stat-row">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {meta && <div className="stat-meta">{meta}</div>}
      </div>
    </div>
  </div>
);

/** Every shop at once. Clicking a row switches into that shop. */
export default function Platform() {
  const { switchShop, can } = useAuth();
  // Being the Super Admin is not the same as having just proved it: the
  // platform-wide profit view waits for the step-up like everything else.
  const { canUnlock, unlocked } = useCostUnlock();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: '' });
  const [data, setData] = useState(null);

  const load = async () => {
    setState({ loading: true, error: '' });
    try {
      const { data: res } = await api.get('/dashboard/super');
      setData(res.data);
      setState({ loading: false, error: '' });
    } catch (err) {
      setState({ loading: false, error: errorMessage(err) });
    }
  };

  useEffect(() => { load(); }, [unlocked]);

  const enter = (shopId) => {
    switchShop(shopId);
    navigate('/dashboard');
    window.location.reload();
  };

  if (state.loading) return <Loading label="Loading platform overview…" />;
  if (state.error) return <ErrorNote message={state.error} onRetry={load} />;

  const p = data.platform;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Platform overview</h1>
          <div className="sub">{data.period} · {p.shops} shop{p.shops === 1 ? '' : 's'}, {p.activeShops} active</div>
        </div>
        {canUnlock && (
          <div className="page-head-actions">
            <CostUnlockButton label="Show profit and investment" />
          </div>
        )}
      </div>

      {canUnlock && !unlocked && (
        <div className="alert alert-info">
          <span>🔒</span>
          <div>
            Profit, margin and stock investment are withheld until you confirm
            your password. Revenue and receivables are shown either way.
          </div>
        </div>
      )}

      <div className="grid grid-4 mb-3">
        <Stat label="Revenue" value={money(p.revenue)} meta={`${number(p.invoices)} invoices`} icon="↗" tone="green" />
        <Stat label="Gross profit" value={money(p.grossProfit)}
              meta={`${money(p.netProfit)} after ${money(p.expenses)} expenses`} icon="◕" tone="green" />
        <Stat label="Stock investment" value={money(p.investment)} meta={`${number(p.skus)} SKUs`} icon="▦" />
        <Stat label="Low stock" value={number(p.lowStock)} meta="across all shops" icon="⚠"
              tone={p.lowStock > 0 ? 'red' : ''} />
      </div>

      <div className="grid grid-4 mb-3">
        <Stat label="Receivables" value={money(p.receivables)} icon="⏳" tone="orange" />
        <Stat label="Payables" value={money(p.payables)} icon="↘" tone="orange" />
        <Stat label="Shops" value={number(p.shops)}
              meta={p.suspendedShops > 0 ? `${p.suspendedShops} suspended` : 'all active'} icon="⌂" />
        <Stat label="Users" value={number(p.users)} icon="⚇" />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Shops, ranked by revenue this month</h2>
          {can(CAPS.SHOP_MANAGE) && (
            <div className="actions">
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/shops')}>Manage shops</button>
            </div>
          )}
        </div>

        {data.shops.length === 0 ? (
          <Empty icon="⌂" title="No shops yet" hint="Create the first shop to get started." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Shop</th><th className="num">Revenue</th><th className="num">Profit</th>
                  <th className="num">Margin</th><th className="num">Invoices</th>
                  <th className="num">Investment</th><th className="num">Receivable</th>
                  <th className="num">Low stock</th><th />
                </tr>
              </thead>
              <tbody>
                {data.shops.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <div className="strong">{s.name}</div>
                      <div className="small muted">
                        {s.code}{s.city ? ` · ${s.city}` : ''}
                        {s.status !== 'active' && <span className="badge badge-gray" style={{ marginLeft: 6 }}>suspended</span>}
                      </div>
                    </td>
                    <td className="num strong">{money(s.revenue)}</td>
                    <td className="num">{money(s.grossProfit)}</td>
                    <td className="num muted">{unlocked ? `${s.marginPercent}%` : '••••'}</td>
                    <td className="num muted">{number(s.invoices)}</td>
                    <td className="num muted">{money(s.investment)}</td>
                    <td className="num" style={{ color: s.receivables > 0 ? 'var(--warning)' : undefined }}>
                      {s.receivables > 0 ? money(s.receivables) : '—'}
                    </td>
                    <td className="num">
                      {s.lowStock > 0 ? <span className="badge badge-red">{s.lowStock}</span> : <span className="muted">—</span>}
                    </td>
                    <td className="actions-cell">
                      <button className="btn btn-ghost btn-sm" onClick={() => enter(s._id)}>Open →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
