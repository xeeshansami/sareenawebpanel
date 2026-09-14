import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import publicApi, { publicError } from '../../api/publicApi.js';
import { useConsumer } from '../../context/ConsumerContext.jsx';
import ProductCard from '../../components/shop/ProductCard.jsx';
import { Loading, Empty, ErrorNote } from '../../components/States.jsx';

/** One shop's storefront: who they are, and everything they have published. */
export default function ShopPage() {
  const { id } = useParams();
  const { isSignedIn, setCartQuantity } = useConsumer();

  const [shop, setShop] = useState(null);
  const [items, setItems] = useState([]);
  const [state, setState] = useState({ loading: true, error: '' });
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setState({ loading: true, error: '' });
    try {
      const [detail, products] = await Promise.all([
        publicApi.get(`/public/shops/${id}`),
        publicApi.get('/public/products', { params: { shopId: id, limit: 48 } }),
      ]);
      setShop(detail.data.data);
      setItems(products.data.data || []);
      setState({ loading: false, error: '' });
    } catch (err) {
      setState({ loading: false, error: publicError(err) });
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const add = async (product, quantity) => {
    if (!isSignedIn) { setNotice('Sign in to start a cart.'); return; }
    setBusyId(product.id);
    try {
      await setCartQuantity(product.id, quantity);
      setNotice('');
    } catch (err) {
      setNotice(publicError(err));
    } finally {
      setBusyId(null);
    }
  };

  if (state.loading) return <div className="store-page"><Loading label="Loading shop…" /></div>;
  if (state.error) {
    return (
      <div className="store-page">
        <ErrorNote message={state.error} onRetry={load} />
        <Link to="/" className="btn btn-ghost">← Back to all parts</Link>
      </div>
    );
  }

  return (
    <div className="store-page">
      <nav className="crumbs">
        <Link to="/">All parts</Link>
        {shop.market && <> · {shop.market.name}</>}
      </nav>

      <div className="shop-hero">
        <div className="shop-mark">{shop.name.slice(0, 2).toUpperCase()}</div>
        <div>
          <h1>{shop.name}</h1>
          <div className="muted">
            {[shop.address, shop.city].filter(Boolean).join(', ')}
            {shop.market && ` · ${shop.market.name}`}
          </div>
          <div className="small muted mt-1">
            {shop.products} part{shop.products === 1 ? '' : 's'} listed
            {shop.phone && ` · ${shop.phone}`}
          </div>
        </div>
      </div>

      {notice && (
        <div className="alert alert-info">
          <span>🛒</span>
          <div style={{ flex: 1 }}>{notice}</div>
          {!isSignedIn && <Link to="/signin" className="btn btn-primary btn-sm">Sign in</Link>}
        </div>
      )}

      {items.length === 0 ? (
        <Empty icon="▣" title="Nothing published yet" hint="This shop has not listed any parts publicly." />
      ) : (
        <div className="pgrid">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} onAdd={add} busy={busyId === p.id} />
          ))}
        </div>
      )}
    </div>
  );
}
