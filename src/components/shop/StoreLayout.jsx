import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import publicApi from '../../api/publicApi.js';
import { useConsumer } from '../../context/ConsumerContext.jsx';
import ErrorBoundary from '../ErrorBoundary.jsx';

/**
 * The public storefront shell (§8, §9, §32).
 *
 * This is what opens when someone types the address — not the admin panel. The
 * only route into the panel is the "Staff sign in" link, and nothing here ever
 * redirects a visitor towards it (§37).
 *
 * Deliberately a different shell from the admin Layout rather than the same one
 * with things hidden: mixing them is how internal figures end up one CSS rule
 * away from a customer's screen.
 */
export default function StoreLayout() {
  const { consumer, isSignedIn, totalItems, marketId, chooseMarket, signOut } = useConsumer();
  const [markets, setMarkets] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    publicApi.get('/public/markets')
      .then(({ data }) => setMarkets(data.data || []))
      .catch(() => setMarkets([]));
  }, []);

  useEffect(() => { setTerm(params.get('q') || ''); }, [params]);
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const search = (e) => {
    e.preventDefault();
    const next = new URLSearchParams();
    if (term.trim()) next.set('q', term.trim());
    navigate(`/?${next.toString()}`);
  };

  return (
    <div className="store">
      <header className="store-head">
        <div className="store-head-inner">
          <Link to="/" className="store-brand">
            <span className="store-mark">PH</span>
            <span>
              <span className="store-name">PartHub</span>
              <span className="store-tag">Mobile parts marketplace</span>
            </span>
          </Link>

          <form className="store-search" onSubmit={search}>
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search a part or a model — LCD, panel, A15, X6816…"
              aria-label="Search parts"
            />
            <button type="submit" className="btn btn-primary">Search</button>
          </form>

          <div className="store-actions">
            <select
              className="store-market"
              value={marketId}
              onChange={(e) => chooseMarket(e.target.value)}
              aria-label="Market"
            >
              <option value="">All markets</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.city ? ` · ${m.city}` : ''}
                </option>
              ))}
            </select>

            <NavLink to="/cart" className="store-cart">
              <span aria-hidden>🛒</span>
              <span className="store-cart-label">Cart</span>
              {totalItems > 0 && <span className="store-cart-count">{totalItems}</span>}
            </NavLink>

            {isSignedIn ? (
              <div className="store-user">
                <button className="btn btn-ghost btn-sm" onClick={() => setMenuOpen((v) => !v)}>
                  {consumer.name.split(' ')[0]} ▾
                </button>
                {menuOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setMenuOpen(false)} />
                    <div className="dropdown">
                      <button className="dropdown-item" onClick={() => navigate('/my/orders')}>
                        <span>◷</span> My orders
                      </button>
                      <button className="dropdown-item" onClick={() => navigate('/my/account')}>
                        <span>☺</span> My details
                      </button>
                      <div className="dropdown-sep" />
                      <button
                        className="dropdown-item"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => { signOut(); navigate('/'); }}
                      >
                        <span>⏻</span> Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link to="/signin" className="btn btn-ghost btn-sm">Sign in</Link>
            )}
          </div>
        </div>
      </header>

      <main className="store-body"><ErrorBoundary resetKey={location.pathname}><Outlet /></ErrorBoundary></main>

      <footer className="store-foot">
        <div className="store-foot-inner">
          <span className="small muted">
            Prices are set by each shop. Stock shown is indicative — the shop confirms every order.
          </span>
          {/* The only way in, and it never opens by itself (§37). */}
          <Link to="/login" className="small">Staff sign in →</Link>
        </div>
      </footer>
    </div>
  );
}
