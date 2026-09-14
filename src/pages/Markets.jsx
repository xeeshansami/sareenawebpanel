import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage, CAPS, PLATFORM_SCOPE } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import usePagedList from '../hooks/usePagedList.js';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import { money, number, date } from '../utils/format.js';
import { CostUnlockButton } from '../components/CostUnlock.jsx';
import useCostRefresh from '../hooks/useCostRefresh.js';

const blank = {
  name: '', code: '', city: '', address: '', description: '',
  contactPhone: '', contactEmail: '', isPublic: false,
  withAdmin: true,
  admin: { firstName: '', lastName: '', email: '', password: '', phone: '' },
};

/**
 * Markets sit above shops: a market is a physical marketplace or plaza, and
 * every shop belongs to exactly one. This page is where they come from — a
 * shop cannot be created until one exists.
 */
export default function Markets() {
  // Markets are above shops, so this list is never narrowed to a selected shop.
  const list = usePagedList('/markets', { config: PLATFORM_SCOPE });
  const { can } = useAuth();
  const navigate = useNavigate();
  const { canUnlock, unlocked } = useCostRefresh(list.reload);

  const canManage = can(CAPS.MARKET_MANAGE);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setAdmin = (k) => (e) => setForm((f) => ({ ...f, admin: { ...f.admin, [k]: e.target.value } }));

  const openCreate = () => { setEditing(null); setForm(blank); setError(''); setCreated(null); setOpen(true); };

  const openEdit = (m) => {
    setEditing(m);
    setForm({
      ...blank,
      name: m.name, code: m.code, city: m.city || '', address: m.address || '',
      description: m.description || '',
      contactPhone: m.contactPhone || '', contactEmail: m.contactEmail || '',
      isPublic: Boolean(m.isPublic), withAdmin: false,
    });
    setError(''); setCreated(null); setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) {
        const { withAdmin, admin, code, ...rest } = form;
        await api.put(`/markets/${editing._id}`, rest, PLATFORM_SCOPE);
        setOpen(false);
      } else {
        const { withAdmin, admin, ...rest } = form;
        const payload = { ...rest, code: rest.code.toUpperCase(), ...(withAdmin ? { admin } : {}) };
        const { data } = await api.post('/markets', payload, PLATFORM_SCOPE);
        setCreated(data.data);
      }
      list.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (market, status) => {
    const shops = market.stats?.shops || 0;
    const warning = status === 'suspended'
      ? `\n\nEvery shop inside it (${shops}) will stop being able to sign in.`
      : '';
    if (!window.confirm(`${status === 'suspended' ? 'Suspend' : 'Reactivate'} ${market.name}?${warning}`)) return;
    try {
      const { data } = await api.post(`/markets/${market._id}/status`, { status }, PLATFORM_SCOPE);
      window.alert(data.message);
      list.reload();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  };

  const openDetail = async (market) => {
    setDetail({ _id: market._id, name: market.name });
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/markets/${market._id}`, PLATFORM_SCOPE);
      setDetail(data.data);
    } catch (err) {
      setDetail({ name: market.name, error: errorMessage(err) });
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Markets</h1>
          <div className="sub">
            A market is a marketplace or plaza. Every shop belongs to one, so a market comes first.
          </div>
        </div>
        <div className="page-head-actions">
          {canUnlock && !unlocked && <CostUnlockButton label="Show profit" />}
          {canManage && <button className="btn btn-primary" onClick={openCreate}>+ New market</button>}
        </div>
      </div>

      <ErrorNote message={list.error} onRetry={list.reload} />

      <div className="card">
        <div className="card-head">
          <input
            className="search" placeholder="Search by name, code or city…"
            value={list.search} onChange={(e) => list.setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>

        {list.loading ? (
          <Loading />
        ) : list.items.length === 0 ? (
          <Empty
            icon="◎"
            title={list.search ? 'No markets match your search' : 'No markets yet'}
            hint={canManage
              ? 'Create the first market, then add shops inside it.'
              : 'A Super Admin creates markets.'}
            action={canManage && !list.search
              ? <button className="btn btn-primary" onClick={openCreate}>+ New market</button>
              : null}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>City</th>
                    <th className="num">Shops</th>
                    <th className="num">Users</th>
                    <th>Public</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((m) => (
                    <tr key={m._id}>
                      <td>
                        <div className="strong">{m.name}</div>
                        <div className="small muted mono">{m.code}</div>
                      </td>
                      <td className="muted">{m.city || '—'}</td>
                      <td className="num">
                        {number(m.stats?.shops)}
                        {m.stats?.shops > 0 && m.stats.activeShops !== m.stats.shops && (
                          <div className="small muted">{number(m.stats.activeShops)} active</div>
                        )}
                      </td>
                      <td className="num muted">{number(m.stats?.users)}</td>
                      <td>
                        <span className={`badge ${m.isPublic ? 'badge-green' : 'badge-gray'}`}>
                          {m.isPublic ? 'listed' : 'private'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${m.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="muted small nowrap">{date(m.createdAt)}</td>
                      <td className="actions-cell">
                        <button className="btn btn-ghost btn-sm" onClick={() => openDetail(m)}>View</button>{' '}
                        {canManage && (
                          <>
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>Edit</button>{' '}
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setStatus(m, m.status === 'active' ? 'suspended' : 'active')}
                            >
                              {m.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>
                          </>
                        )}
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

      {/* ── create / edit ── */}
      <Modal
        open={open}
        title={created ? 'Market created' : editing ? `Edit ${editing.name}` : 'New market'}
        onClose={() => { setOpen(false); setCreated(null); }}
        wide
        footer={created ? (
          <>
            <button className="btn btn-ghost" onClick={() => { setOpen(false); setCreated(null); }}>Done</button>
            <button className="btn btn-primary" onClick={() => navigate('/shops')}>Add a shop</button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <><span className="spinner" /> Saving…</> : editing ? 'Save changes' : 'Create market'}
            </button>
          </>
        )}
      >
        {created ? (
          <>
            <div className="alert alert-success">
              <span>✓</span>
              <div><strong>{created.market.name}</strong> is ready. Shops can now be created inside it.</div>
            </div>
            {created.admin && (
              <div className="card" style={{ background: 'var(--surface-2)' }}>
                <div className="card-body">
                  <div className="strong mb-2">Market admin sign-in</div>
                  <div className="flex" style={{ justifyContent: 'space-between' }}>
                    <span className="muted">Email</span><span className="mono">{created.admin.email}</span>
                  </div>
                  <div className="flex mt-2" style={{ justifyContent: 'space-between' }}>
                    <span className="muted">Password</span><span className="mono">{form.admin.password}</span>
                  </div>
                  <div className="hint mt-2">
                    Shown once. This account runs the market: it creates the shops inside it and reads
                    their data, and can see nothing in any other market.
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
                <label>Market name *</label>
                <input value={form.name} onChange={set('name')} required autoFocus
                       placeholder="Saddar Mobile Market" />
              </div>
              <div className="field">
                <label>Code *</label>
                <input value={form.code} onChange={set('code')} required disabled={Boolean(editing)}
                       maxLength={10} placeholder="SDR" style={{ textTransform: 'uppercase' }} />
                <div className="hint">
                  {editing
                    ? 'Fixed — shops inside this market have already issued documents.'
                    : 'Letters and digits only. Identifies the market across the platform.'}
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="field"><label>City</label><input value={form.city} onChange={set('city')} /></div>
              <div className="field"><label>Phone</label><input value={form.contactPhone} onChange={set('contactPhone')} /></div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={form.contactEmail} onChange={set('contactEmail')} />
              </div>
            </div>

            <div className="field"><label>Address</label><textarea value={form.address} onChange={set('address')} /></div>
            <div className="field">
              <label>Description</label>
              <textarea value={form.description} onChange={set('description')} />
            </div>

            <label className="flex items-center mt-2" style={{ fontWeight: 500 }}>
              <input type="checkbox" checked={form.isPublic} onChange={set('isPublic')}
                     style={{ width: 'auto', marginRight: 6 }} />
              List this market on the public marketplace
            </label>
            <div className="hint">
              Off by default. Listing the market does not publish any shop's products — each product
              is published on its own.
            </div>

            {!editing && (
              <>
                <label className="flex items-center mt-3" style={{ fontWeight: 500 }}>
                  <input type="checkbox" checked={form.withAdmin} onChange={set('withAdmin')}
                         style={{ width: 'auto', marginRight: 6 }} />
                  Create the market admin now
                </label>

                {form.withAdmin && (
                  <div className="card mt-2" style={{ background: 'var(--surface-2)' }}>
                    <div className="card-body">
                      <div className="form-row">
                        <div className="field">
                          <label>First name *</label>
                          <input value={form.admin.firstName} onChange={setAdmin('firstName')} required />
                        </div>
                        <div className="field">
                          <label>Last name</label>
                          <input value={form.admin.lastName} onChange={setAdmin('lastName')} />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="field">
                          <label>Email *</label>
                          <input type="email" value={form.admin.email} onChange={setAdmin('email')} required />
                        </div>
                        <div className="field">
                          <label>Password *</label>
                          <input type="text" value={form.admin.password} onChange={setAdmin('password')}
                                 required minLength={6} placeholder="at least 6 characters" />
                        </div>
                      </div>
                      <div className="hint">
                        A market admin can create shops in this market and read their data. They cannot
                        create markets, and cannot see another market at all.
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </form>
        )}
      </Modal>

      {/* ── detail ── */}
      <Modal
        open={Boolean(detail)}
        title={detail?.name || 'Market'}
        onClose={() => setDetail(null)}
        wide
        footer={<button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>}
      >
        {detailLoading ? (
          <Loading />
        ) : detail?.error ? (
          <div className="alert alert-error"><span>⚠</span><div>{detail.error}</div></div>
        ) : detail ? (
          <>
            <div className="form-row">
              <div><div className="small muted">Code</div><div className="strong mono">{detail.code}</div></div>
              <div><div className="small muted">City</div><div className="strong">{detail.city || '—'}</div></div>
              <div><div className="small muted">Status</div><div className="strong">{detail.status}</div></div>
            </div>
            {detail.address && <div className="mt-2 muted">{detail.address}</div>}

            <div className="strong mt-3 mb-2">Shops ({detail.shops?.length || 0})</div>
            {(detail.shops || []).length === 0 ? (
              <div className="alert alert-info">
                <span>⌂</span>
                <div>
                  No shops in this market yet.{' '}
                  <button className="link-btn" onClick={() => { setDetail(null); navigate('/shops'); }}>
                    Create one
                  </button>
                </div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Shop</th><th>City</th><th>Public</th><th>Status</th><th>Created</th></tr>
                  </thead>
                  <tbody>
                    {detail.shops.map((s) => (
                      <tr key={s._id}>
                        <td><div className="strong">{s.name}</div><div className="small muted mono">{s.code}</div></td>
                        <td className="muted">{s.city || '—'}</td>
                        <td className="muted">{s.isPublic ? 'listed' : 'private'}</td>
                        <td>
                          <span className={`badge ${s.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="muted small nowrap">{date(s.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="strong mt-3 mb-2">Market admins ({detail.admins?.length || 0})</div>
            {(detail.admins || []).length === 0 ? (
              <div className="small muted">
                None. Without one, only a Super Admin can create shops in this market.
              </div>
            ) : (
              <div>
                {detail.admins.map((a) => (
                  <div key={a._id || a.id} className="flex mt-1" style={{ justifyContent: 'space-between' }}>
                    <span>{a.firstName} {a.lastName}</span>
                    <span className="mono small muted">{a.email}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </Modal>
    </>
  );
}
