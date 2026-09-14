import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client.js';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import { TrendChart, RankChart } from '../components/Chart.jsx';
import { money, number } from '../utils/format.js';
import { CostUnlockButton } from '../components/CostUnlock.jsx';
import { useCostUnlock } from '../context/CostUnlockContext.jsx';

const RANGES = [
  ['today', 'Today'], ['week', '7 days'], ['month', 'Month'],
  ['quarter', '90 days'], ['year', 'Year'], ['all', 'All time'],
];

const DIMENSIONS = [
  ['product', 'Product'], ['brand', 'Brand'], ['category', 'Part type'],
  ['model', 'Model'], ['user', 'Salesperson'],
];

export default function Reports() {
  const { canUnlock, unlocked } = useCostUnlock();
  const showCost = unlocked;

  const [range, setRange] = useState('month');
  const [dimension, setDimension] = useState('product');
  const [state, setState] = useState({ loading: true, error: '' });
  const [data, setData] = useState(null);
  const [breakdown, setBreakdown] = useState([]);

  const load = async () => {
    setState({ loading: true, error: '' });
    try {
      const { data: res } = await api.get('/reports/overview', { params: { range } });
      setData(res.data);
      setState({ loading: false, error: '' });
    } catch (err) {
      setState({ loading: false, error: errorMessage(err) });
    }
  };

  useEffect(() => { load(); }, [range]);

  useEffect(() => {
    api.get(`/reports/by/${dimension}`, { params: { range, limit: 20 } })
      .then(({ data: res }) => setBreakdown(res.data))
      .catch(() => setBreakdown([]));
  }, [dimension, range, unlocked]);

  if (state.loading) return <Loading label="Building report…" />;
  if (state.error) return <ErrorNote message={state.error} onRetry={load} />;

  const s = data.summary;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <div className="sub">
            {showCost
              ? 'Profit is revenue minus cost of goods sold, then minus expenses'
              : canUnlock
                ? 'Profit and margin are locked — confirm your password to include them'
                : 'Cost and margin figures are hidden for your role'}
          </div>
        </div>
        <div className="page-head-actions">
          <div className="seg">
            {RANGES.map(([key, label]) => (
              <button key={key} aria-pressed={range === key} onClick={() => setRange(key)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-4 mb-3">
        <div className="card hero">
          <div className="hero-label">Revenue</div>
          <div className="hero-value">{money(s.revenue)}</div>
          <div className="hero-meta">{number(s.invoices)} invoices · {number(s.units)} units</div>
        </div>
        {showCost && (
          <>
            <div className="card hero">
              <div className="hero-label">Gross profit</div>
              <div className="hero-value" style={{ color: 'var(--success)' }}>{money(s.grossProfit)}</div>
              <div className="hero-meta">{s.grossMarginPercent}% margin · {money(s.cogs)} cost of goods</div>
            </div>
            <div className="card hero">
              <div className="hero-label">Net profit</div>
              <div className="hero-value">{money(s.netProfit)}</div>
              <div className="hero-meta">after {money(s.expenses)} in {number(s.expenseCount)} expenses</div>
            </div>
          </>
        )}
        {!showCost && canUnlock && (
          <div className="card hero">
            <div className="hero-label">Gross profit</div>
            <div className="hero-value muted">••••</div>
            <div className="hero-meta"><CostUnlockButton label="Show profit" /></div>
          </div>
        )}
        <div className="card hero">
          <div className="hero-label">Outstanding</div>
          <div className="hero-value" style={{ color: s.outstanding > 0 ? 'var(--warning)' : undefined }}>
            {money(s.outstanding)}
          </div>
          <div className="hero-meta">{money(s.collected)} collected in period</div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-head">
          <h2>Revenue{showCost ? ' and profit' : ''} over time</h2>
          {!showCost && canUnlock && <div className="actions"><CostUnlockButton label="Add profit" /></div>}
        </div>
        <div className="card-body">
          {data.series.length === 0
            ? <Empty icon="◫" title="Nothing sold in this period" />
            : <TrendChart data={data.series} showProfit={showCost} height={260} />}
        </div>
      </div>

      <div className="grid grid-2 mb-3">
        <div className="card">
          <div className="card-head">
            <h2>Breakdown</h2>
            <div className="actions">
              <select value={dimension} onChange={(e) => setDimension(e.target.value)} style={{ width: 150 }}>
                {DIMENSIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          </div>
          {breakdown.length === 0 ? (
            <Empty icon="◪" title="No data for this breakdown" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{DIMENSIONS.find(([k]) => k === dimension)?.[1]}</th>
                    <th className="num">Units</th>
                    <th className="num">Revenue</th>
                    {showCost && <th className="num">Profit</th>}
                    {showCost && <th className="num">Margin</th>}
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((r) => (
                    <tr key={String(r.id) + r.label}>
                      <td>
                        <div className="strong">{r.label}</div>
                        {r.sku && <div className="small muted mono">{r.sku}</div>}
                      </td>
                      <td className="num">{number(r.units)}</td>
                      <td className="num strong">{money(r.revenue)}</td>
                      {showCost && <td className="num" style={{ color: 'var(--success)' }}>{money(r.grossProfit)}</td>}
                      {showCost && <td className="num muted">{r.marginPercent}%</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head"><h2>Top sellers</h2></div>
          <div className="card-body">
            {data.topProducts.length === 0
              ? <Empty icon="▣" title="No sales in this period" />
              : <RankChart data={data.topProducts} dataKey="units" labelKey="label" height={280} />}
          </div>
        </div>
      </div>

      {data.movers && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-head">
              <h2>Slow movers</h2>
              <div className="actions small muted">last {data.movers.windowDays} days</div>
            </div>
            {data.movers.slow.length === 0 ? <Empty icon="▦" title="Nothing on the shelf" /> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Product</th><th className="num">On hand</th><th className="num">Sold</th>
                        {showCost && <th className="num">Tied up</th>}</tr>
                  </thead>
                  <tbody>
                    {data.movers.slow.map((p) => (
                      <tr key={p.id}>
                        <td><div className="strong">{p.name}</div><div className="small muted mono">{p.sku}</div></td>
                        <td className="num">{number(p.onHand)}</td>
                        <td className="num">
                          {p.unitsSold === 0
                            ? <span className="badge badge-red">none</span>
                            : number(p.unitsSold)}
                        </td>
                        {showCost && <td className="num muted">{money(p.stockValue)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {showCost && data.movers.deadStock.count > 0 && (
              <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="alert alert-warning" style={{ marginBottom: 0 }}>
                  <span>⚠</span>
                  <div>
                    <strong>{data.movers.deadStock.count} products sold nothing</strong> in the window,
                    holding {money(data.movers.deadStock.value)} of stock.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head"><h2>Fast movers</h2></div>
            {data.movers.fast.length === 0 ? <Empty icon="↗" title="No sales in the window" /> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Product</th><th className="num">Sold</th><th className="num">On hand</th>
                        <th className="num">Days cover</th></tr>
                  </thead>
                  <tbody>
                    {data.movers.fast.map((p) => (
                      <tr key={p.id}>
                        <td><div className="strong">{p.name}</div><div className="small muted mono">{p.sku}</div></td>
                        <td className="num strong">{number(p.unitsSold)}</td>
                        <td className="num">{number(p.onHand)}</td>
                        <td className="num">
                          {p.daysOfCover === null ? '—'
                            : <span className={`badge ${p.daysOfCover < 7 ? 'badge-red' : p.daysOfCover < 21 ? 'badge-orange' : 'badge-gray'}`}>
                                {p.daysOfCover}d
                              </span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
