import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import publicApi from '../../api/publicApi.js';
import { useConsumer, publicError } from '../../context/ConsumerContext.jsx';
import { Empty } from '../../components/States.jsx';
import { money } from '../../utils/format.js';

/**
 * One cart per shop, shown as separate baskets (§26).
 *
 * The split is visible while shopping rather than appearing at checkout: an
 * order belongs to one shop, so a basket mixing three shops has to become three
 * orders eventually, and finding that out at the last step is a nasty surprise.
 */
export default function CartPage() {
  const { consumer, isSignedIn, carts, setCartQuantity, clearCart, refreshCarts } = useConsumer();
  const navigate = useNavigate();

  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState('');
  const [details, setDetails] = useState({});

  if (!isSignedIn) {
    return (
      <div className="store-page store-narrow">
        <Empty
          icon="🛒"
          title="Sign in to see your cart"
          hint="Your basket is kept with your account, so it follows you between your phone and your computer."
          action={<Link to="/signin" state={{ from: '/cart' }} className="btn btn-primary">Sign in</Link>}
        />
      </div>
    );
  }

  if (carts.length === 0) {
    return (
      <div className="store-page store-narrow">
        <Empty
          icon="🛒"
          title="Your cart is empty"
          hint="Search for a model number, or browse a shop."
          action={<Link to="/" className="btn btn-primary">Browse parts</Link>}
        />
      </div>
    );
  }

  const changeLine = async (productId, quantity) => {
    setBusy(productId);
    setError('');
    try {
      await setCartQuantity(productId, quantity);
    } catch (err) {
      setError(publicError(err));
    } finally {
      setBusy('');
    }
  };

  const detailFor = (shopId) => details[shopId] || {
    contactName: consumer?.name || '',
    contactPhone: consumer?.phone || '',
    deliveryAddress: consumer?.address || '',
    note: '',
  };

  const setDetail = (shopId, key) => (e) =>
    setDetails((d) => ({ ...d, [shopId]: { ...detailFor(shopId), [key]: e.target.value } }));

  const placeOrder = async (cart) => {
    const detail = detailFor(cart.shop.id);
    if (!detail.contactName?.trim()) {
      setError('A name is needed so the shop knows who is collecting.');
      return;
    }
    setPlacing(cart.shop.id);
    setError('');
    try {
      const { data } = await publicApi.post('/consumer/orders', {
        shopId: cart.shop.id,
        contactName: detail.contactName,
        contactPhone: detail.contactPhone,
        deliveryAddress: detail.deliveryAddress,
        note: detail.note,
      });
      await refreshCarts();
      navigate(`/my/orders?placed=${data.data.orderNo}`);
    } catch (err) {
      setError(publicError(err));
    } finally {
      setPlacing('');
    }
  };

  return (
    <div className="store-page">
      <h1>Your cart</h1>
      <p className="muted">
        {carts.length === 1
          ? 'One shop.'
          : `${carts.length} shops — each is ordered separately, because a shop can only fulfil its own parts.`}
      </p>

      {error && <div className="alert alert-error"><span>⚠</span><div>{error}</div></div>}

      {carts.map((cart) => {
        const detail = detailFor(cart.shop.id);
        const blocked = cart.hasStockProblem || cart.hasUnavailable;

        return (
          <div className="card mb-3" key={cart.id}>
            <div className="card-head">
              <h2>
                <Link to={`/shop/${cart.shop.id}`}>{cart.shop.name}</Link>
              </h2>
              <div className="actions">
                <button className="link-btn small" onClick={() => clearCart(cart.shop.id)}>
                  Empty this cart
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Part</th>
                    <th className="num">Price</th>
                    <th className="num">Quantity</th>
                    <th className="num">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cart.items.map((line) => (
                    <tr key={line.productId}>
                      <td>
                        {line.available ? (
                          <>
                            <Link to={`/product/${line.productId}`} className="strong">{line.name}</Link>
                            <div className="small muted">
                              {line.brandName}{line.sku ? ` · ${line.sku}` : ''}
                            </div>
                            {line.exceedsStock && (
                              <div className="small" style={{ color: 'var(--warning)' }}>
                                The shop does not have this many right now — reduce the quantity to order.
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="strong">{line.name}</span>
                            <div className="small" style={{ color: 'var(--danger)' }}>
                              No longer available — remove it to place the order.
                            </div>
                          </>
                        )}
                      </td>
                      <td className="num">{line.available ? money(line.salePrice) : '—'}</td>
                      <td className="num">
                        <input
                          type="number" min={0} max={99} value={line.quantity}
                          disabled={busy === line.productId}
                          onChange={(e) => changeLine(line.productId, Math.max(0, Number(e.target.value) || 0))}
                          style={{ width: 72 }}
                        />
                      </td>
                      <td className="num strong">{line.available ? money(line.lineTotal) : '—'}</td>
                      <td className="actions-cell">
                        <button
                          className="link-btn small"
                          onClick={() => changeLine(line.productId, 0)}
                          disabled={busy === line.productId}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card-body">
              <div className="form-row">
                <div className="field">
                  <label>Name for the order *</label>
                  <input value={detail.contactName} onChange={setDetail(cart.shop.id, 'contactName')} required />
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input value={detail.contactPhone} onChange={setDetail(cart.shop.id, 'contactPhone')} />
                </div>
              </div>
              <div className="field">
                <label>Delivery address</label>
                <input value={detail.deliveryAddress} onChange={setDetail(cart.shop.id, 'deliveryAddress')} />
                <div className="hint">Leave blank if you are collecting from the shop.</div>
              </div>
              <div className="field">
                <label>Note for the shop</label>
                <textarea
                  value={detail.note}
                  onChange={setDetail(cart.shop.id, 'note')}
                  maxLength={500}
                  placeholder="Anything they should know — a model to double-check, a time to call."
                />
              </div>

              <div className="cart-total">
                <div>
                  <div className="small muted">{cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}</div>
                  <div className="pdetail-amount">{money(cart.subtotal)}</div>
                </div>
                <button
                  className="btn btn-primary"
                  disabled={blocked || placing === cart.shop.id || cart.itemCount === 0}
                  onClick={() => placeOrder(cart)}
                >
                  {placing === cart.shop.id
                    ? <><span className="spinner" /> Placing…</>
                    : `Place order with ${cart.shop.name}`}
                </button>
              </div>

              <p className="small muted mt-2">
                Nothing is charged here. The shop confirms the order, sets aside the parts, and
                arranges payment with you directly.
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
