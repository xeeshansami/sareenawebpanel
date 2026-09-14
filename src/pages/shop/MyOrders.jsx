import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import publicApi from '../../api/publicApi.js';
import { useConsumer, publicError } from '../../context/ConsumerContext.jsx';
import { Loading, Empty, ErrorNote } from '../../components/States.jsx';
import { money, dateTime } from '../../utils/format.js';

/** How each order state reads to the person who placed it. */
const STATUS = {
  pending:    { label: 'Waiting for the shop', tone: 'badge-orange', note: 'The shop has not accepted it yet.' },
  confirmed:  { label: 'Accepted', tone: 'badge-green', note: 'The shop has set the parts aside for you.' },
  processing: { label: 'Being prepared', tone: 'badge-green', note: '' },
  ready:      { label: 'Ready', tone: 'badge-green', note: 'Ready to collect or be sent.' },
  completed:  { label: 'Completed', tone: 'badge-gray', note: '' },
  rejected:   { label: 'Declined', tone: 'badge-red', note: '' },
  cancelled:  { label: 'Cancelled', tone: 'badge-gray', note: '' },
};

export default function MyOrders() {
  const { isSignedIn } = useConsumer();
  const [params] = useSearchParams();
  const justPlaced = params.get('placed');

  const [orders, setOrders] = useState([]);
  const [state, setState] = useState({ loading: true, error: '' });
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setState({ loading: true, error: '' });
    try {
      const { data } = await publicApi.get('/consumer/orders', { params: { limit: 50 } });
      setOrders(data.data || []);
      setState({ loading: false, error: '' });
    } catch (err) {
      setState({ loading: false, error: publicError(err) });
    }
  }, []);

  useEffect(() => { if (isSignedIn) load(); else setState({ loading: false, error: '' }); }, [isSignedIn, load]);

  const cancel = async (order) => {
    if (!window.confirm(`Cancel order ${order.orderNo}?`)) return;
    setBusy(order.id);
    try {
      await publicApi.post(`/consumer/orders/${order.id}/cancel`, {});
      await load();
    } catch (err) {
      window.alert(publicError(err));
    } finally {
      setBusy('');
    }
  };

  if (!isSignedIn) {
    return (
      <div className="store-page store-narrow">
        <Empty
          icon="◷"
          title="Sign in to see your orders"
          action={<Link to="/signin" state={{ from: '/my/orders' }} className="btn btn-primary">Sign in</Link>}
        />
      </div>
    );
  }

  if (state.loading) return <div className="store-page"><Loading label="Loading your orders…" /></div>;

  return (
    <div className="store-page">
      <h1>Your orders</h1>

      {justPlaced && (
        <div className="alert alert-success">
          <span>✓</span>
          <div>
            <strong>Order {justPlaced} placed.</strong> The shop will accept it and set the parts
            aside — you can cancel until then.
          </div>
        </div>
      )}

      <ErrorNote message={state.error} onRetry={load} />

      {orders.length === 0 ? (
        <Empty
          icon="◷"
          title="No orders yet"
          hint="Anything you order will appear here with its progress."
          action={<Link to="/" className="btn btn-primary">Browse parts</Link>}
        />
      ) : (
        orders.map((order) => {
          const s = STATUS[order.status] || { label: order.status, tone: 'badge-gray', note: '' };
          return (
            <div className="card mb-3" key={order.id}>
              <div className="card-head">
                <h2>
                  <span className="mono">{order.orderNo}</span>{' '}
                  <span className={`badge ${s.tone}`}>{s.label}</span>
                </h2>
                <div className="actions small muted">{dateTime(order.placedAt)}</div>
              </div>

              <div className="card-body">
                <div className="small muted mb-2">
                  {order.shop?.name}
                  {order.market?.name ? ` · ${order.market.name}` : ''}
                  {order.shop?.phone ? ` · ${order.shop.phone}` : ''}
                </div>

                {s.note && <div className="small mb-2">{s.note}</div>}

                {order.status === 'rejected' && order.rejectedReason && (
                  <div className="alert alert-warning">
                    <span>⚠</span>
                    <div>The shop declined this order: {order.rejectedReason}</div>
                  </div>
                )}

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Part</th><th className="num">Price</th>
                        <th className="num">Qty</th><th className="num">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((line, i) => (
                        <tr key={i}>
                          <td>
                            <div className="strong">{line.name}</div>
                            {line.brandName && <div className="small muted">{line.brandName}</div>}
                          </td>
                          <td className="num">{money(line.salePrice)}</td>
                          <td className="num">{line.quantity}</td>
                          <td className="num strong">{money(line.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="cart-total">
                  <div>
                    <div className="small muted">{order.itemCount} item{order.itemCount === 1 ? '' : 's'}</div>
                    <div className="pdetail-amount">{money(order.subtotal)}</div>
                  </div>
                  {order.canCancel && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => cancel(order)}
                      disabled={busy === order.id}
                    >
                      Cancel this order
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
