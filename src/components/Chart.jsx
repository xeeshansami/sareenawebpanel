import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { money, number } from '../utils/format.js';

const TONE = { good: 'var(--success)', warning: 'var(--warning)', critical: 'var(--danger)' };

/**
 * Shared chart chrome. Grid and axes are recessive, text uses text tokens
 * rather than the series colour, and series colours come from the validated
 * palette in index.css.
 */
const axis = { fontSize: 11, fill: 'var(--text-3)' };
const gridProps = { strokeDasharray: '3 3', stroke: 'var(--grid)', vertical: false };

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--text)',
  boxShadow: 'var(--shadow-lg)',
};

export function Legendary({ items }) {
  if (items.length < 2) return null;
  return (
    <div className="chart-legend">
      {items.map((i) => (
        <span className="key" key={i.label}>
          <span className="swatch" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Revenue and profit over time. One axis — both series are money. */
export function TrendChart({ data, showProfit = true, height = 240 }) {
  const series = [
    { key: 'revenue', label: 'Revenue', color: 'var(--series-1)' },
    ...(showProfit ? [{ key: 'grossProfit', label: 'Gross profit', color: 'var(--series-2)' }] : []),
  ];

  return (
    <>
      <Legendary items={series} />
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient id={`fill-${s.key}`} key={s.key} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.24} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="period" tick={axis} stroke="var(--grid)" tickFormatter={(d) => String(d).slice(5)} />
          <YAxis tick={axis} stroke="var(--grid)" width={62}
                 tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [money(v), n]} />
          {series.map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label}
                  stroke={s.color} strokeWidth={2} fill={`url(#fill-${s.key})`} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </>
  );
}

/** Horizontal ranking. Rounded data-ends, anchored at the baseline. */
export function RankChart({ data, dataKey = 'units', labelKey = 'label', valueFormat = number, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps} horizontal={false} vertical />
        <XAxis type="number" tick={axis} stroke="var(--grid)" />
        <YAxis type="category" dataKey={labelKey} tick={{ ...axis, fontSize: 10.5, fill: 'var(--text-2)' }}
               width={150} stroke="var(--grid)" />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => valueFormat(v)} cursor={{ fill: 'var(--surface-2)' }} />
        <Bar dataKey={dataKey} fill="var(--series-1)" radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Part-to-whole for a handful of states. A stacked bar rather than a donut:
 * these values are often close, and a bar compares close values honestly.
 * Every segment carries its label and count, so colour is never the only
 * encoding — which is also what the status palette requires.
 */
export function StatusBar({ items, unit = '' }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return <div className="muted small" style={{ padding: '12px 0' }}>Nothing to show yet</div>;

  return (
    <>
      <div className="status-bar" role="img"
           aria-label={items.map((i) => `${i.label}: ${i.value}`).join(', ')}>
        {items.filter((i) => i.value > 0).map((i) => (
          <span key={i.label} style={{ flex: i.value, background: TONE[i.tone] || 'var(--series-1)' }} />
        ))}
      </div>
      <div className="status-keys">
        {items.map((i) => (
          <div className="status-key" key={i.label}>
            <span className="dot" style={{ background: TONE[i.tone] || 'var(--series-1)' }} />
            <span className="n">{number(i.value)}</span>
            <span className="l">{i.label}</span>
            {i.amount > 0 && <span className="sub">{money(i.amount)}</span>}
          </div>
        ))}
      </div>
      <div className="small muted" style={{ marginTop: 10 }}>
        {number(total)} {unit || 'total'} · {Math.round((items[0].value / total) * 100)}% {items[0].label.toLowerCase()}
      </div>
    </>
  );
}

/** Money over time for two comparable series — sales against purchases. */
export function CompareChart({ data, keys, height = 240 }) {
  return (
    <>
      <Legendary items={keys} />
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {keys.map((k) => (
              <linearGradient id={`cmp-${k.key}`} key={k.key} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={k.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={k.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--text-3)' }} stroke="var(--grid)"
                 tickFormatter={(d) => String(d).slice(5)} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} stroke="var(--grid)" width={62}
                 tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
          <Tooltip contentStyle={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, fontSize: 12, color: 'var(--text)', boxShadow: 'var(--shadow-lg)',
          }} formatter={(v, n) => [money(v), n]} />
          {keys.map((k) => (
            <Area key={k.key} type="monotone" dataKey={k.key} name={k.label}
                  stroke={k.color} strokeWidth={2} fill={`url(#cmp-${k.key})`} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </>
  );
}
