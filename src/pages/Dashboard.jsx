import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api, { errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import { TrendChart, RankChart, StatusBar } from '../components/Chart.jsx';
import { money, number, dateTime, statusBadge } from '../utils/format.js';
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

export default function Dashboard() {
  const { viewingAllShops } = useAuth();
  // The API sends profit only while a step-up unlock is held, so the UI follows
  // the unlock — not the capability. Having the capability only means the user
  // is allowed to ask.
  const { canUnlock, unlocked } = useCostUnlock();
  const showCost = unlocked;

  const [state, setState] = useState({ loading: true, error: '' });
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [top, setTop] = useState([]);
  const [recent, setRecent] = useState([]);
  const [byBrand, setByBrand] = useState([]);
  const [byType, setByType] = useState([]);

  const load = async () => {
    setState({ loading: true, error: '' });
    try {
      const [s, t, p, r, b, c] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/sales-trend?days=30'),
        api.get('/dashboard/top-products?limit=8'),
        api.get('/dashboard/recent-sales?limit=8'),
        api.get('/reports/by/brand', { params: { range: 'month', limit: 8 } }).catch(() => ({ data: { data: [] } })),
        api.get('/reports/by/category', { params: { range: 'month', limit: 8 } }).catch(() => ({ data: { data: [] } })),
      ]);
      setSummary(s.data.data);
      setTrend(t.data.data);
      setTop(p.data.data);
      setRecent(r.data.data);
      setByBrand(b.data.data || []);
      setByType(c.data.data || []);
      setState({ loading: false, error: '' });
    } catch (err) {
      setState({ loading: false, error: errorMessage(err) });
    }
  };

  useEffect(() => { load(); }, [unlocked]);

  // Super Admin with no shop selected belongs on the platform view.
  if (viewingAllShops) return <Navigate to="/platform" replace />;
  if (state.loading) return <Loading label="Loading dashboard…" />;

  return (
    <>
      <ErrorNote message={state.error} onRetry={load} />

      {summary && (
        <>
          <div className="grid grid-4 mb-3">
            <Stat label="Sales today" value={money(summary.today.revenue)}
                  meta={`${number(summary.today.invoices)} invoice${summary.today.invoices === 1 ? '' : 's'} · ${number(summary.today.units)} units`}
                  icon="↗" tone="green" />
            {showCost ? (
              <Stat label="Profit today" value={money(summary.today.grossProfit)}
                    meta={`${summary.today.marginPercent}% margin`} icon="◕" tone="green" />
            ) : canUnlock ? (
              <Stat label="Profit today" value={<CostUnlockButton compact />}
                    meta="password required" icon="◕" tone="green" />
            ) : (
              <Stat label="Collected today" value={money(summary.today.collected)} icon="◕" tone="green" />
            )}
            <Stat label="Receivables" value={money(summary.money.receivables)}
                  meta={<Link to="/ledgers">{summary.money.receivableParties} customers owe you →</Link>}
                  icon="⏳" tone="orange" />
            <Stat label="Low stock" value={number(summary.catalogue.lowStock)}
                  meta={<Link to="/inventory">{summary.catalogue.outOfStock} out of stock →</Link>}
                  icon="⚠" tone={summary.catalogue.lowStock > 0 ? 'red' : ''} />
          </div>

          <div className="grid grid-4 mb-3">
            <Stat label="This month" value={money(summary.month.revenue)}
                  meta={showCost ? `${money(summary.month.grossProfit)} profit · ${summary.month.marginPercent}%` : `${number(summary.month.invoices)} invoices`}
                  icon="◫" />
            {showCost && summary.investment && (
              <Stat label="Stock investment" value={money(summary.investment.investment)}
                    meta={`${number(summary.investment.units)} units · ${money(summary.investment.potentialGrossProfit)} potential`}
                    icon="▦" />
            )}
            <Stat label="Payables" value={money(summary.money.payables)}
                  meta={`${summary.money.payableParties} suppliers`} icon="↘" tone="orange" />
            <Stat label="Catalogue" value={number(summary.catalogue.products)}
                  meta={`${number(summary.catalogue.customers)} customers · ${number(summary.catalogue.suppliers)} suppliers`}
                  icon="▣" />
          </div>

          {summary.catalogue.openEstimates > 0 && (
            <div className="alert alert-info">
              <span>◷</span>
              <div style={{ flex: 1 }}>
                <strong>{summary.catalogue.openEstimates} open estimate{summary.catalogue.openEstimates === 1 ? '' : 's'}</strong>
                {' '}— none of them have moved stock yet.
              </div>
              <Link to="/estimates" className="btn btn-ghost btn-sm">Review</Link>
            </div>
          )}
        </>
      )}

      <div className="card mb-3">
        <div className="card-head">
          <h2>Revenue{showCost ? ' and profit' : ''} — last 30 days</h2>
          {!showCost && canUnlock && <div className="actions"><CostUnlockButton label="Add profit" /></div>}
        </div>
        <div className="card-body">
          {trend.length === 0
            ? <Empty icon="◫" title="No sales yet" hint="Record a sale to see the trend." />
            : <TrendChart data={trend} showProfit={showCost} height={250} />}
        </div>
      </div>

      {summary && (
        <div className="grid grid-2 mb-3">
          <div className="card">
            <div className="card-head">
              <h2>Stock health</h2>
              <div className="actions small muted">{number(summary.catalogue.products)} active products</div>
            </div>
            <div className="card-body">
              <StatusBar items={summary.stockHealth} unit="products" />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Invoice status</h2>
              <div className="actions small muted">all time</div>
            </div>
            <div className="card-body">
              <StatusBar items={summary.invoiceStatus} unit="invoices" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-2 mb-3">
        <div className="card">
          <div className="card-head"><h2>Top products by units</h2></div>
          <div className="card-body">
            {top.length === 0
              ? <Empty icon="▣" title="No product sales yet" />
              : <RankChart data={top} dataKey="units" labelKey="label" />}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Revenue by brand</h2>
            <div className="actions small muted">this month</div>
          </div>
          <div className="card-body">
            {byBrand.length === 0
              ? <Empty icon="⌸" title="No brand sales this month" />
              : <RankChart data={byBrand} dataKey="revenue" labelKey="label" valueFormat={money} />}
          </div>
        </div>
      </div>

      <div className="grid grid-2 mb-3">
        <div className="card">
          <div className="card-head">
            <h2>Revenue by part type</h2>
            <div className="actions small muted">this month</div>
          </div>
          <div className="card-body">
            {byType.length === 0
              ? <Empty icon="▦" title="No sales this month" />
              : <RankChart data={byType} dataKey="revenue" labelKey="label" valueFormat={money} />}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Units sold by brand</h2>
            <div className="actions small muted">this month</div>
          </div>
          <div className="card-body">
            {byBrand.length === 0
              ? <Empty icon="⌸" title="No brand sales this month" />
              : <RankChart data={byBrand} dataKey="units" labelKey="label" />}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Recent invoices</h2>
          <div className="actions"><Link to="/sales" className="btn btn-ghost btn-sm">View all</Link></div>
        </div>
        {recent.length === 0 ? (
          <Empty icon="↗" title="No invoices yet" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th><th>Customer</th><th className="num">Items</th>
                  <th className="num">Total</th><th className="num">Due</th><th>Status</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s._id}>
                    <td className="mono">{s.invoiceNo}</td>
                    <td>{s.customerName}</td>
                    <td className="num muted">{s.itemCount}</td>
                    <td className="num strong">{money(s.totalAmount)}</td>
                    <td className="num">{s.dueAmount > 0 ? money(s.dueAmount) : '—'}</td>
                    <td><span className={`badge ${statusBadge(s.status)}`}>{s.status}</span></td>
                    <td className="muted small nowrap">{dateTime(s.createdAt)}</td>
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
