import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api, { CAPS } from '../api/client.js';
import { initials } from '../utils/format.js';
import ShopSwitcher from './ShopSwitcher.jsx';
import { CostUnlockButton, CostUnlockDialog } from './CostUnlock.jsx';
import { useCostUnlock } from '../context/CostUnlockContext.jsx';

/**
 * Two sidebars, not one with things hidden (§24, §25).
 *
 * The Super Admin's job and the shopkeeper's job barely overlap: one manages
 * markets, shops and who may sign in; the other runs a business. A single menu
 * covering both would be long for everyone and wrong for each, so the shape of
 * the navigation follows the role and the contents still follow capabilities —
 * which is what an approved Shop User with a partial grant needs.
 *
 * A hidden link is not security. The API enforces every one of these; the menu
 * just avoids offering things that would 403.
 */
const PLATFORM_NAV = [
  { section: 'Platform' },
  { to: '/platform', label: 'Dashboard', icon: '◎', cap: CAPS.SHOP_VIEW_ALL },
  { to: '/markets', label: 'Markets', icon: '◈', cap: CAPS.MARKET_REPORT },
  { to: '/shops', label: 'Shops', icon: '⌂', cap: CAPS.SHOP_MANAGE },

  { section: 'Access' },
  { to: '/users', label: 'Shopkeepers & users', icon: '⚇', cap: CAPS.USER_MANAGE, badge: 'pending' },

  { section: 'Monitoring' },
  { to: '/products', label: 'Products', icon: '▣', cap: CAPS.PRODUCT_VIEW },
  { to: '/inventory', label: 'Inventory', icon: '▦', cap: CAPS.INVENTORY_VIEW },
  { to: '/reports', label: 'Reports', icon: '◪', cap: CAPS.REPORT_VIEW },

  { section: 'System' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

const SHOP_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '◫', cap: CAPS.REPORT_VIEW },

  { section: 'Catalogue' },
  { to: '/products', label: 'Products', icon: '▣', cap: CAPS.PRODUCT_VIEW },
  { to: '/models', label: 'Brands & models', icon: '⌸', cap: CAPS.PRODUCT_VIEW },
  { to: '/inventory', label: 'Inventory', icon: '▦', cap: CAPS.INVENTORY_VIEW, badge: 'lowStock' },

  { section: 'Trade' },
  { to: '/sales', label: 'Sales', icon: '↗', cap: CAPS.SALE_VIEW },
  { to: '/purchases', label: 'Purchases', icon: '↘', cap: CAPS.PURCHASE_VIEW },
  // Reading an invoice is its own permission: a user who may see purchases
  // cannot necessarily import one.
  { to: '/imports', label: 'Import invoice', icon: '⎘', cap: CAPS.OCR_USE },
  { to: '/orders', label: 'Orders', icon: '☷', cap: CAPS.ORDER_VIEW, badge: 'orders' },

  { section: 'Customers' },
  { to: '/customers', label: 'Customers', icon: '☺', cap: CAPS.CUSTOMER_VIEW },
  { to: '/ledgers', label: 'Credit / Udhaar', icon: '☰', cap: CAPS.LEDGER_VIEW },

  { section: 'Shop' },
  { to: '/reports', label: 'Reports', icon: '◪', cap: CAPS.REPORT_VIEW },
  { to: '/users', label: 'Users', icon: '⚇', cap: CAPS.USER_MANAGE },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

const TITLES = {
  '/platform': 'Platform overview', '/markets': 'Markets', '/shops': 'Shops',
  '/orders': 'Orders',
  '/dashboard': 'Dashboard', '/reports': 'Reports',
  '/products': 'Products', '/models': 'Brands & models', '/inventory': 'Inventory',
  '/sales': 'Sales', '/estimates': 'Estimates', '/purchases': 'Purchases',
  '/customers': 'Customers', '/suppliers': 'Suppliers', '/ledgers': 'Credit / Udhaar',
  '/users': 'Users & access', '/settings': 'Settings',
};

export default function Layout() {
  const { user, logout, can, isSuperAdmin, viewingAllShops, shop } = useAuth();
  const { canUnlock, unlocked, lock } = useCostUnlock();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lowStock, setLowStock] = useState(0);
  const [openOrders, setOpenOrders] = useState(0);
  const [pendingUsers, setPendingUsers] = useState(0);
  const [theme, setTheme] = useState(() => localStorage.getItem('sareena_theme') || 'light');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sareena_theme', theme);
  }, [theme]);

  useEffect(() => { setSidebarOpen(false); setMenuOpen(false); }, [location.pathname]);

  // Badge counts. Each is guarded by its capability, and a failure is silent:
  // a missing badge is a small loss, an error banner over the whole panel is not.
  useEffect(() => {
    if (!can(CAPS.INVENTORY_VIEW) || viewingAllShops) { setLowStock(0); return undefined; }
    let cancelled = false;
    api.get('/inventory/low-stock')
      .then(({ data }) => !cancelled && setLowStock(data.count || 0))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [location.pathname, viewingAllShops]);

  useEffect(() => {
    if (!can(CAPS.ORDER_VIEW) || viewingAllShops) { setOpenOrders(0); return undefined; }
    let cancelled = false;
    api.get('/orders/summary')
      .then(({ data }) => !cancelled && setOpenOrders(data.data?.open || 0))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [location.pathname, viewingAllShops]);

  // §6 — the Super Admin should see a request is waiting without going to look.
  useEffect(() => {
    if (!can(CAPS.USER_APPROVE)) { setPendingUsers(0); return undefined; }
    let cancelled = false;
    api.get('/users/pending', { params: { limit: 1 } })
      .then(({ data }) => !cancelled && setPendingUsers(data.pagination?.total || 0))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [location.pathname]);

  const handleLogout = async () => {
    lock();
    await logout();
    navigate('/login', { replace: true });
  };

  // The Super Admin runs the platform; everyone else runs a shop (§39).
  const source = isSuperAdmin ? PLATFORM_NAV : SHOP_NAV;
  const badgeCount = { lowStock, orders: openOrders, pending: pendingUsers };

  const visible = source.filter((item) => !item.cap || can(item.cap));
  // Drop a section header whose items were all filtered out.
  const nav = visible.filter((item, i) => {
    if (!item.section) return true;
    const next = visible[i + 1];
    return next && !next.section;
  });

  return (
    <div className="app">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">S</div>
          <div style={{ minWidth: 0 }}>
            <div className="brand-text">Panel Hisab</div>
            <div className="brand-sub">
              {isSuperAdmin ? 'Platform admin' : shop?.name || 'Shop'}
            </div>
          </div>
        </div>

        <nav className="nav">
          {nav.map((item, i) =>
            item.section ? (
              <div className="nav-section" key={`s-${i}`}>{item.section}</div>
            ) : (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && badgeCount[item.badge] > 0 && (
                  <span className="nav-badge">{badgeCount[item.badge]}</span>
                )}
              </NavLink>
            )
          )}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle menu">☰</button>
          <div className="topbar-title">{TITLES[location.pathname] || 'Panel Hisab'}</div>
          <div className="topbar-spacer" />

          <ShopSwitcher />

          {canUnlock && (
            <div className="topbar-costlock">
              <CostUnlockButton label="Purchase rates" />
            </div>
          )}

          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>

          <div className="user-menu">
            <button className="user-btn" onClick={() => setMenuOpen((v) => !v)}>
              <div className="avatar">{initials(user?.firstName, user?.lastName)}</div>
              <div style={{ textAlign: 'left' }}>
                <div className="user-name">{user?.firstName} {user?.lastName}</div>
                <div className="user-role">{user?.role}</div>
              </div>
              <span style={{ color: 'var(--text-3)', fontSize: 10 }}>▼</span>
            </button>

            {menuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setMenuOpen(false)} />
                <div className="dropdown">
                  <div style={{ padding: '8px 10px' }} className="small muted">
                    {user?.email}
                    {!can(CAPS.COST_VIEW)
                      ? <div style={{ marginTop: 4 }}>Purchase rates hidden for your role</div>
                      : <div style={{ marginTop: 4 }}>
                          Purchase rates {unlocked ? 'unlocked for this session' : 'locked — password required'}
                        </div>}
                  </div>
                  <div className="dropdown-sep" />
                  <button className="dropdown-item" onClick={() => navigate('/settings')}><span>⚙</span> Settings</button>
                  <button className="dropdown-item" onClick={() => navigate('/')}>
                    <span>🛒</span> View the storefront
                  </button>
                  <div className="dropdown-sep" />
                  <button className="dropdown-item" onClick={handleLogout} style={{ color: 'var(--danger)' }}>
                    <span>⏻</span> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {viewingAllShops && (
          <div
            className="small"
            style={{
              background: 'var(--primary-soft)', color: 'var(--primary)',
              padding: '7px 22px', borderBottom: '1px solid var(--border)', fontWeight: 600,
            }}
          >
            Viewing all shops — pick one from the switcher above to create or edit records.
          </div>
        )}

        <main className="content"><Outlet /></main>
      </div>

      <CostUnlockDialog />
    </div>
  );
}
