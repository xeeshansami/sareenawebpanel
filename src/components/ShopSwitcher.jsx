import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Super Admin shop selector. Choosing a shop scopes every subsequent request
 * to it; "All shops" returns the platform-wide view. A full reload follows a
 * switch so no panel is left holding the previous shop's data.
 */
export default function ShopSwitcher() {
  const { isSuperAdmin, activeShopId, switchShop } = useAuth();
  const [shops, setShops] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get('/shops', { params: { limit: 100 } })
      .then(({ data }) => setShops(data.data || []))
      .catch(() => {});
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return null;

  const active = shops.find((s) => String(s._id) === String(activeShopId));

  const choose = (shopId) => {
    setOpen(false);
    if (String(shopId || '') === String(activeShopId || '')) return;
    switchShop(shopId);
    window.location.reload();
  };

  return (
    <div className="user-menu">
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen((v) => !v)} title="Switch shop">
        <span style={{ opacity: 0.6 }}>⌂</span>
        <span className="strong">{active ? active.name : 'All shops'}</span>
        <span style={{ color: 'var(--text-3)', fontSize: 10 }}>▼</span>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setOpen(false)} />
          <div className="dropdown" style={{ minWidth: 260, maxHeight: 380, overflowY: 'auto' }}>
            <button
              className="dropdown-item"
              onClick={() => choose(null)}
              style={{ fontWeight: !activeShopId ? 650 : 500 }}
            >
              <span>◎</span>
              <div>
                <div>All shops</div>
                <div className="small muted">Platform-wide totals</div>
              </div>
            </button>
            <div className="dropdown-sep" />
            {shops.map((s) => (
              <button
                key={s._id}
                className="dropdown-item"
                onClick={() => choose(s._id)}
                style={{ fontWeight: String(s._id) === String(activeShopId) ? 650 : 500 }}
              >
                <span>{s.status === 'active' ? '●' : '○'}</span>
                <div style={{ minWidth: 0 }}>
                  <div>{s.name}</div>
                  <div className="small muted">
                    {s.code}{s.city ? ` · ${s.city}` : ''}
                    {s.status !== 'active' ? ' · suspended' : ''}
                  </div>
                </div>
              </button>
            ))}
            {shops.length === 0 && <div className="small muted" style={{ padding: 10 }}>No shops yet</div>}
          </div>
        </>
      )}
    </div>
  );
}
