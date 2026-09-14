import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage, CAPS, PLATFORM_SCOPE } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import usePagedList from '../hooks/usePagedList.js';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import { money, number, date } from '../utils/format.js';

const blank = {
  name: '', code: '', ownerName: '', phone: '', email: '', city: '', address: '',
  marketId: '',
  withAdmin: true,
  admin: { firstName: '', lastName: '', email: '', password: '', phone: '' },
};

export default function Shops() {
  // Every shop on the platform, not only those in the market of whichever
  // shop is currently selected.
  const list = usePagedList('/shops', { config: PLATFORM_SCOPE });
  const { switchShop, can, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  /**
   * Every shop belongs to a market, so the market has to be answerable here.
   *
   * Only a Super Admin chooses: a market admin's shops always land in their own
   * market, and the API resolves that server-side rather than trusting input.
   */
  const [markets, setMarkets] = useState(null);   // null = not loaded yet
  const [marketError, setMarketError] = useState('');

  useEffect(() => {
    if (!isSuperAdmin || !can(CAPS.MARKET_REPORT)) { setMarkets([]); return undefined; }
    let cancelled = false;
    api.get('/markets', { ...PLATFORM_SCOPE, params: { limit: 100, status: 'active' } })
      .then(({ data }) => !cancelled && setMarkets(data.data || []))
      .catch((err) => !cancelled && setMarketError(errorMessage(err)));
    return () => { cancelled = true; };
  }, [isSuperAdmin]);

  const needsMarket = isSuperAdmin;
  const noMarketsYet = needsMarket && Array.isArray(markets) && markets.length === 0;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setAdmin = (k) => (e) => setForm((f) => ({ ...f, admin: { ...f.admin, [k]: e.target.value } }));

  const openCreate = () => {
    setEditing(null);
    // One market is the common case — pre-select it rather than making someone
    // pick from a list of one.
    const only = Array.isArray(markets) && markets.length === 1 ? markets[0]._id : '';
    setForm({ ...blank, marketId: only });
    setError(''); setCreated(null); setOpen(true);
  };
  const openEdit = (s) => {
    setEditing(s);
    setForm({ ...blank, name: s.name, code: s.code, ownerName: s.ownerName || '', phone: s.phone || '',
              email: s.email || '', city: s.city || '', address: s.address || '',
              marketId: s.market?._id || s.market || '', withAdmin: false });
    setError(''); setCreated(null); setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) {
        const { withAdmin, admin, code, marketId, ...rest } = form;
        // Moving a shop between markets changes who can see its data, so send
        // marketId only when it actually changed.
        const moved = String(marketId || '') !== String(editing.market?._id || editing.market || '')
          ? { marketId }
          : {};
        await api.put(`/shops/${editing._id}`, { ...rest, ...moved }, PLATFORM_SCOPE);
        setOpen(false);
      } else {
        const { withAdmin, admin, marketId, ...rest } = form;
        const payload = {
          ...rest,
          ...(needsMarket ? { marketId } : {}),
          ...(withAdmin ? { admin } : {}),
        };
        const { data } = await api.post('/shops', payload, PLATFORM_SCOPE);
        setCreated(data.data);
      }
      list.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (shop, status) => {
    const verb = status === 'suspended' ? 'Suspend' : 'Reactivate';
    if (!window.confirm(`${verb} ${shop.name}?${status === 'suspended' ? ' Its users will not be able to sign in.' : ''}`)) return;
    try {
      await api.post(`/shops/${shop._id}/status`, { status }, PLATFORM_SCOPE);
      list.reload();
    } catch (err) { window.alert(errorMessage(err)); }
  };

  const enter = (shopId) => { switchShop(shopId); navigate('/dashboard'); window.location.reload(); };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Shops</h1>
          <div className="sub">Each shop is a separate tenant — its data is never visible to another</div>
        </div>
        <div className="page-head-actions">
          {noMarketsYet ? (
            <button className="btn btn-primary" onClick={() => navigate('/markets')}>
              + New market first
            </button>
          ) : (
            <button className="btn btn-primary" onClick={openCreate} disabled={markets === null}>
              + New shop
            </button>
          )}
        </div>
      </div>

      <ErrorNote message={list.error} onRetry={list.reload} />
      <ErrorNote message={marketError} />

      {noMarketsYet && (
        <div className="alert alert-info">
          <span>◈</span>
          <div style={{ flex: 1 }}>
            <strong>No markets exist yet.</strong> A shop belongs to a market, so the market comes
            first — a marketplace or plaza, with the shops inside it.
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/markets')}>
            Create a market
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <input className="search" placeholder="Search shops…" value={list.search}
                 onChange={(e) => list.setSearch(e.target.value)} style={{ maxWidth: 320 }} />
        </div>

        {list.loading ? <Loading /> : list.items.length === 0 ? (
          <Empty
            icon="⌂"
            title="No shops yet"
            hint={noMarketsYet
              ? 'A shop belongs to a market, and no market exists yet.'
              : 'Create the first shop and its admin.'}
            action={noMarketsYet
              ? <button className="btn btn-primary" onClick={() => navigate('/markets')}>Create a market</button>
              : <button className="btn btn-primary" onClick={openCreate}>+ New shop</button>}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Shop</th><th>Market</th><th>Owner</th><th className="num">Products</th><th className="num">Revenue</th>
                      <th className="num">Receivable</th><th className="num">Users</th><th>Status</th><th>Created</th><th /></tr>
                </thead>
                <tbody>
                  {list.items.map((s) => (
                    <tr key={s._id}>
                      <td>
                        <div className="strong">{s.name}</div>
                        <div className="small muted mono">{s.code}{s.city ? ` · ${s.city}` : ''}</div>
                      </td>
                      <td className="muted">
                        {s.market?.name || '—'}
                        {s.market?.code && <div className="small mono">{s.market.code}</div>}
                      </td>
                      <td className="muted">{s.ownerName || '—'}<div className="small">{s.phone || ''}</div></td>
                      <td className="num muted">{number(s.stats?.products)}</td>
                      <td className="num strong">{money(s.stats?.revenue)}</td>
                      <td className="num">{s.stats?.receivables > 0 ? money(s.stats.receivables) : '—'}</td>
                      <td className="num muted">{number(s.stats?.users)}</td>
                      <td>
                        <span className={`badge ${s.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{s.status}</span>
                      </td>
                      <td className="muted small nowrap">{date(s.createdAt)}</td>
                      <td className="actions-cell">
                        <button className="btn btn-ghost btn-sm" onClick={() => enter(s._id)}>Open</button>{' '}
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>Edit</button>{' '}
                        <button className="btn btn-ghost btn-sm"
                                onClick={() => setStatus(s, s.status === 'active' ? 'suspended' : 'active')}>
                          {s.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={list.pagination} onPage={list.setPage} />
          </>
        )}
      </div>

      <Modal
        open={open}
        title={created ? 'Shop created' : editing ? `Edit ${editing.name}` : 'New shop'}
        onClose={() => { setOpen(false); setCreated(null); }}
        wide
        footer={created ? (
          <button className="btn btn-primary" onClick={() => { setOpen(false); setCreated(null); }}>Done</button>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <><span className="spinner" /> Saving…</> : editing ? 'Save changes' : 'Create shop'}
            </button>
          </>
        )}
      >
        {created ? (
          <>
            <div className="alert alert-success">
              <span>✓</span>
              <div><strong>{created.shop.name}</strong> is ready.</div>
            </div>
            {created.admin && (
              <div className="card" style={{ background: 'var(--surface-2)' }}>
                <div className="card-body">
                  <div className="strong mb-2">Shop admin sign-in</div>
                  <div className="flex" style={{ justifyContent: 'space-between' }}>
                    <span className="muted">Email</span><span className="mono">{created.admin.email}</span>
                  </div>
                  <div className="flex mt-2" style={{ justifyContent: 'space-between' }}>
                    <span className="muted">Password</span><span className="mono">{form.admin.password}</span>
                  </div>
                  <div className="hint mt-2">
                    This password is shown once. Pass it to the shop owner and have them change it.
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={save}>
            {error && <div className="alert alert-error"><span>⚠</span><div>{error}</div></div>}

            <div className="form-row">
              <div className="field">
                <label>Shop name *</label>
                <input value={form.name} onChange={set('name')} required autoFocus />
              </div>
              <div className="field">
                <label>Code *</label>
                <input value={form.code} onChange={set('code')} required disabled={Boolean(editing)}
                       placeholder="SAR" maxLength={10} style={{ textTransform: 'uppercase' }} />
                <div className="hint">
                  {editing ? 'Fixed — it appears in every document number already issued.' : 'Appears in invoice numbers: SAR-INV-000001'}
                </div>
              </div>
            </div>

            {needsMarket && (
              <div className="field">
                <label>Market *</label>
                <select value={form.marketId} onChange={set('marketId')} required>
                  <option value="">Select the market this shop sits in…</option>
                  {(markets || []).map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name} ({m.code}){m.city ? ` — ${m.city}` : ''}
                    </option>
                  ))}
                </select>
                <div className="hint">
                  {editing
                    ? 'Changing this moves the shop, and with it who can see its data. Only a Super Admin can.'
                    : 'Suspended markets are not listed — a shop cannot be created inside one.'}
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="field"><label>Owner name</label><input value={form.ownerName} onChange={set('ownerName')} /></div>
              <div className="field"><label>Phone</label><input value={form.phone} onChange={set('phone')} /></div>
              <div className="field"><label>City</label><input value={form.city} onChange={set('city')} /></div>
            </div>

            <div className="field"><label>Email</label><input type="email" value={form.email} onChange={set('email')} /></div>
            <div className="field"><label>Address</label><textarea value={form.address} onChange={set('address')} /></div>

            {!editing && (
              <>
                <label className="flex items-center mt-3" style={{ fontWeight: 500 }}>
                  <input type="checkbox" checked={form.withAdmin} onChange={set('withAdmin')}
                         style={{ width: 'auto', marginRight: 6 }} />
                  Create the shop admin now
                </label>

                {form.withAdmin && (
                  <div className="card mt-2" style={{ background: 'var(--surface-2)' }}>
                    <div className="card-body">
                      <div className="form-row">
                        <div className="field"><label>First name *</label>
                          <input value={form.admin.firstName} onChange={setAdmin('firstName')} required /></div>
                        <div className="field"><label>Last name</label>
                          <input value={form.admin.lastName} onChange={setAdmin('lastName')} /></div>
                      </div>
                      <div className="form-row">
                        <div className="field"><label>Email *</label>
                          <input type="email" value={form.admin.email} onChange={setAdmin('email')} required /></div>
                        <div className="field"><label>Password *</label>
                          <input type="text" value={form.admin.password} onChange={setAdmin('password')}
                                 required minLength={6} placeholder="at least 6 characters" /></div>
                      </div>
                      <div className="hint">This account can manage everything inside this shop, and nothing outside it.</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </form>
        )}
      </Modal>
    </>
  );
}
