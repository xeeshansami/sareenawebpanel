import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api, { errorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import { OrdersChart, DistributionChart } from '../components/Chart.jsx';
import { money, number, dateTime, statusBadge } from '../utils/format.js';

/**
 * The shopkeeper's dashboard.
 *
 * Four numbers, the last ten invoices and three charts. What used to be here
 * and is gone: today's profit, receivables, low stock, the catalogue tile, the
 * revenue/profit trend, stock health, invoice status, top products by units,
 * revenue by brand, revenue by part type and units sold by brand.
 *
 * They are gone from the page *and* from what it fetches. This used to make six
 * requests — /dashboard/summary, /sales-trend, /top-products, /recent-sales and
 * two /reports/by calls — and render whichever arrived. It now makes one, to an
 * endpoint that returns only these figures. Leaving the old calls in place
 * behind hidden markup would have kept every one of those aggregations running
 * on each page load for nothing.
 *
 * Profit is not on this page at all, so the cost-unlock machinery that used to
 * drive it is gone with it. The lock still exists in the topbar for the pages
 * that do show cost.
 */

const Stat = ({ label, value, meta, icon, tone = '', to }) => {
  const body = (
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
  return to ? <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>{body}</Link> : body;
};

export default function Dashboard() {
  const { viewingAllShops } = useAuth();
  const [state, setState] = useState({ loading: true, error: '' });
  const [data, setData] = useState(null);

  const load = async () => {
    setState({ loading: true, error: '' });
    try {
      const { data: res } = await api.get('/dashboard/shopkeeper', { params: { recentLimit: 10, days: 14 } });
      setData(res.data);
      setState({ loading: false, error: '' });
    } catch (err) {
      setState({ loading: false, error: errorMessage(err) });
    }
  };

  useEffect(() => { load(); }, []);

  // A Super Admin with no shop selected belongs on the platform view — this
  // page is about one shop's counter.
  if (viewingAllShops) return <Navigate to="/platform" replace />;
  if (state.loading) return <Loading label="Loading dashboard…" />;

  const totals = data?.totals;
  const charts = data?.charts;
  const recent = data?.recentOrders || [];

  return (
    <>
      <ErrorNote message={state.error} onRetry={load} />

      {totals && (
        <div className="grid grid-4 mb-3">
          <Stat
            label="Today's sales"
            value={money(totals.todaySales)}
            meta={`${number(totals.todayInvoices)} invoice${totals.todayInvoices === 1 ? '' : 's'} today`}
            icon="↗" tone="green" to="/sales"
          />
          <Stat
            label="Total products"
            value={number(totals.totalProducts)}
            meta="active in this shop"
            icon="▣" to="/products"
          />
          <Stat
            label="Total orders"
            value={number(totals.totalOrders)}
            meta="invoices all time"
            icon="☷" to="/sales"
          />
          <Stat
            label="Total brands"
            value={number(totals.totalBrands)}
            meta="in your brand list"
            icon="⌸" to="/brands"
          />
        </div>
      )}

      <div className="card mb-3">
        <div className="card-head">
          <h2>Order activity — last 14 days</h2>
          <div className="actions small muted">invoices per day</div>
        </div>
        <div className="card-body">
          {!charts?.orders?.length ? (
            <Empty icon="☷" title="No order activity yet" hint="Record a sale to see it here." />
          ) : (
            <OrdersChart data={charts.orders} height={230} />
          )}
        </div>
      </div>

      <div className="grid grid-2 mb-3">
        <div className="card">
          <div className="card-head">
            <h2>Products by brand</h2>
            <div className="actions small muted">how the catalogue splits</div>
          </div>
          <div className="card-body">
            {!charts?.productsByBrand?.length ? (
              <Empty icon="⌸" title="No products yet"
                     hint="Add a product and it will appear under its brand." />
            ) : (
              <DistributionChart data={charts.productsByBrand} />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Products by accessory type</h2>
            <div className="actions small muted">how the catalogue splits</div>
          </div>
          <div className="card-body">
            {!charts?.productsByType?.length ? (
              <Empty icon="▦" title="No products yet"
                     hint="Add a product and it will appear under its type." />
            ) : (
              <DistributionChart data={charts.productsByType} />
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Recent orders</h2>
          <div className="actions">
            <Link to="/sales" className="btn btn-ghost btn-sm">View all</Link>
          </div>
        </div>
        {recent.length === 0 ? (
          <Empty icon="↗" title="No orders yet" hint="Invoices you record at the counter appear here." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th className="num">Items</th>
                  <th className="num">Total</th>
                  <th className="num">Due</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s._id}>
                    <td className="mono">{s.invoiceNo}</td>
                    <td>{s.customerName || '—'}</td>
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
