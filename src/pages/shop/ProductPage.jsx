import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import publicApi, { publicError } from '../../api/publicApi.js';
import { useConsumer } from '../../context/ConsumerContext.jsx';
import { StockBadge } from '../../components/shop/ProductCard.jsx';
import { Loading, ErrorNote } from '../../components/States.jsx';
import { money } from '../../utils/format.js';

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isSignedIn, quantityOf, setCartQuantity } = useConsumer();

  const [product, setProduct] = useState(null);
  const [state, setState] = useState({ loading: true, error: '' });
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: '' });
    publicApi.get(`/public/products/${id}`)
      .then(({ data }) => { if (!cancelled) { setProduct(data.data); setState({ loading: false, error: '' }); } })
      .catch((err) => { if (!cancelled) setState({ loading: false, error: publicError(err) }); });
    return () => { cancelled = true; };
  }, [id]);

  const inCart = product ? quantityOf(product.id) : 0;

  const add = async () => {
    if (!isSignedIn) {
      setNotice('Sign in to add this to a cart.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      await setCartQuantity(product.id, inCart + quantity);
      setNotice('Added to your cart.');
    } catch (err) {
      setNotice(publicError(err));
    } finally {
      setBusy(false);
    }
  };

  if (state.loading) return <div className="store-page"><Loading label="Loading part…" /></div>;
  if (state.error) {
    return (
      <div className="store-page">
        <ErrorNote message={state.error} />
        <Link to="/" className="btn btn-ghost">← Back to all parts</Link>
      </div>
    );
  }

  const soldOut = product.stockStatus === 'out_of_stock';

  return (
    <div className="store-page">
      <nav className="crumbs">
        <Link to="/">All parts</Link>
        {product.shop?.market && <> · <Link to={`/?shop=${product.shop.id}`}>{product.shop.market.name}</Link></>}
        {product.shop && <> · <Link to={`/shop/${product.shop.id}`}>{product.shop.name}</Link></>}
      </nav>

      <div className="pdetail">
        <div className="pdetail-media">
          {product.imageUrl
            ? <img src={product.imageUrl} alt={product.name} />
            : <span className="pcard-placeholder" aria-hidden>▣</span>}
        </div>

        <div className="pdetail-info">
          <div className="pcard-meta">
            {product.brand && <span className="badge badge-gray">{product.brand}</span>}
            {product.category && <span className="badge badge-gray">{product.category}</span>}
            {product.technology && <span className="badge badge-gray">{product.technology}</span>}
            {product.quality && <span className="badge badge-gray">{product.quality}</span>}
          </div>

          <h1>{product.name}</h1>

          {product.model && <div className="muted">Fits {product.model}</div>}
          {product.compatibleModels?.length > 0 && (
            <div className="small muted">Also fits: {product.compatibleModels.join(', ')}</div>
          )}

          <div className="pdetail-price">
            <span className="pdetail-amount">{money(product.price)}</span>
            <span className="muted small">per {product.unit || 'pcs'}</span>
            <StockBadge status={product.stockStatus} />
          </div>

          {product.description && <p className="pdetail-desc">{product.description}</p>}

          {notice && (
            <div className="alert alert-info">
              <span>🛒</span>
              <div style={{ flex: 1 }}>{notice}</div>
              {!isSignedIn
                ? <Link to="/signin" className="btn btn-primary btn-sm">Sign in</Link>
                : <Link to="/cart" className="btn btn-ghost btn-sm">View cart</Link>}
            </div>
          )}

          <div className="pdetail-buy">
            <label className="small muted" htmlFor="qty">Quantity</label>
            <input
              id="qty"
              type="number"
              min={1}
              max={99}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              disabled={soldOut}
              style={{ width: 90 }}
            />
            <button className="btn btn-primary" onClick={add} disabled={soldOut || busy}>
              {busy ? <><span className="spinner" /> Adding…</> : soldOut ? 'Out of stock' : 'Add to cart'}
            </button>
            {inCart > 0 && <span className="small muted">{inCart} already in your cart</span>}
          </div>

          {product.shop && (
            <div className="card mt-3">
              <div className="card-body">
                <div className="strong">Sold by {product.shop.name}</div>
                <div className="small muted">
                  {[product.shop.address, product.shop.city].filter(Boolean).join(', ')}
                  {product.shop.market && ` · ${product.shop.market.name}`}
                </div>
                {product.shop.phone && <div className="small mt-1">Phone: {product.shop.phone}</div>}
                <div className="mt-2">
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/shop/${product.shop.id}`)}>
                    See everything from this shop →
                  </button>
                </div>
              </div>
            </div>
          )}

          <p className="small muted mt-3">
            The shop confirms availability when it accepts your order, so stock here is a guide
            rather than a promise.
          </p>
        </div>
      </div>
    </div>
  );
}
