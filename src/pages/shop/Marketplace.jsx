import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import publicApi, { publicError } from '../../api/publicApi.js';
import { useConsumer } from '../../context/ConsumerContext.jsx';
import ProductCard from '../../components/shop/ProductCard.jsx';
import { Loading, Empty, ErrorNote } from '../../components/States.jsx';

const SORTS = [
  ['', 'Most available'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['newest', 'Newest'],
];

/**
 * The front door (§8).
 *
 * Everything here works without an account. Adding to a cart is the first thing
 * that needs one, and it asks at that moment rather than gating the browse.
 */
export default function Marketplace() {
  const { marketId, setCartQuantity, isSignedIn } = useConsumer();
  const [params, setParams] = useSearchParams();

  const [state, setState] = useState({ loading: true, error: '' });
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState({ brands: [], categories: [] });
  const [shops, setShops] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');

  const q = params.get('q') || '';
  const brandId = params.get('brand') || '';
  const categoryId = params.get('category') || '';
  const shopId = params.get('shop') || '';
  const sort = params.get('sort') || '';
  const page = Number(params.get('page') || 1);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const load = useCallback(async () => {
    setState({ loading: true, error: '' });
    try {
      const query = {
        page, limit: 24,
        ...(q ? { search: q } : {}),
        ...(marketId ? { marketId } : {}),
        ...(brandId ? { brandId } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(shopId ? { shopId } : {}),
        ...(sort ? { sort } : {}),
      };
      const [products, filterList, shopList] = await Promise.all([
        publicApi.get('/public/products', { params: query }),
        publicApi.get('/public/filters', { params: marketId ? { marketId } : {} }),
        publicApi.get('/public/shops', { params: marketId ? { marketId } : {} }),
      ]);
      setItems(products.data.data || []);
      setPagination(products.data.pagination || null);
      setFilters(filterList.data.data || { brands: [], categories: [] });
      setShops(shopList.data.data || []);
      setState({ loading: false, error: '' });
    } catch (err) {
      setState({ loading: false, error: publicError(err) });
    }
  }, [q, marketId, brandId, categoryId, shopId, sort, page]);

  useEffect(() => { load(); }, [load]);

  const add = async (product, quantity) => {
    if (!isSignedIn) {
      setNotice('Sign in to start a cart — it takes a moment and keeps your basket across devices.');
      return;
    }
    setBusyId(product.id);
    setNotice('');
    try {
      await setCartQuantity(product.id, quantity);
    } catch (err) {
      setNotice(publicError(err));
    } finally {
      setBusyId(null);
    }
  };

  const activeFilters = [brandId, categoryId, shopId, q].filter(Boolean).length;

  return (
    <div className="store-page">
      <div className="store-hero">
        <h1>Mobile repair parts, from the market</h1>
        <p>
          Panels, displays, batteries, flex cables and boards from shops across the market.
          Search a model number, compare shops, and order from whichever has it.
        </p>
      </div>

      {notice && (
        <div className="alert alert-info">
          <span>🛒</span>
          <div style={{ flex: 1 }}>{notice}</div>
          {!isSignedIn && <Link to="/signin" className="btn btn-primary btn-sm">Sign in</Link>}
        </div>
      )}

      <div className="store-grid">
        <aside className="store-filters">
          <div className="filter-block">
            <div className="filter-title">Shops</div>
            <button className={`filter-chip ${!shopId ? 'active' : ''}`} onClick={() => setParam('shop', '')}>
              All shops
            </button>
            {shops.map((s) => (
              <button
                key={s.id}
                className={`filter-chip ${shopId === s.id ? 'active' : ''}`}
                onClick={() => setParam('shop', s.id)}
              >
                {s.name} <span className="muted">({s.products})</span>
              </button>
            ))}
            {shops.length === 0 && <div className="small muted">No shops are listed yet.</div>}
          </div>

          <div className="filter-block">
            <div className="filter-title">Brand</div>
            <button className={`filter-chip ${!brandId ? 'active' : ''}`} onClick={() => setParam('brand', '')}>
              Any brand
            </button>
            {filters.brands.map((b) => (
              <button
                key={b.id}
                className={`filter-chip ${brandId === b.id ? 'active' : ''}`}
                onClick={() => setParam('brand', b.id)}
              >
                {b.name}
              </button>
            ))}
          </div>

          <div className="filter-block">
            <div className="filter-title">Part type</div>
            <button className={`filter-chip ${!categoryId ? 'active' : ''}`} onClick={() => setParam('category', '')}>
              Any part
            </button>
            {filters.categories.map((c) => (
              <button
                key={c.id}
                className={`filter-chip ${categoryId === c.id ? 'active' : ''}`}
                onClick={() => setParam('category', c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </aside>

        <section>
          <div className="store-listhead">
            <div>
              {pagination && (
                <span className="small muted">
                  {pagination.total} part{pagination.total === 1 ? '' : 's'}
                  {q && <> matching “{q}”</>}
                  {activeFilters > 0 && !q && <> in this selection</>}
                </span>
              )}
            </div>
            <select value={sort} onChange={(e) => setParam('sort', e.target.value)} aria-label="Sort">
              {SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>

          <ErrorNote message={state.error} onRetry={load} />

          {state.loading ? (
            <Loading label="Loading parts…" />
          ) : items.length === 0 ? (
            <Empty
              icon="▣"
              title={q ? `Nothing matched “${q}”` : 'No parts listed yet'}
              hint={q
                ? 'Try a model number on its own — X6816, A15, MI 12C.'
                : 'Shops publish parts one by one; check back shortly.'}
              action={activeFilters > 0
                ? <button className="btn btn-ghost" onClick={() => setParams(new URLSearchParams())}>Clear filters</button>
                : null}
            />
          ) : (
            <>
              <div className="pgrid">
                {items.map((p) => (
                  <ProductCard key={p.id} product={p} onAdd={add} busy={busyId === p.id} />
                ))}
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="store-pager">
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={!pagination.hasPrev}
                    onClick={() => setParam('page', String(page - 1))}
                  >
                    ← Previous
                  </button>
                  <span className="small muted">Page {pagination.page} of {pagination.totalPages}</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={!pagination.hasNext}
                    onClick={() => setParam('page', String(page + 1))}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
