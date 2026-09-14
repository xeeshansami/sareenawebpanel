import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage, CAPS, PLATFORM_SCOPE } from '../api/client.js';
import usePagedList from '../hooks/usePagedList.js';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import { dateTime, initials } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Staff accounts, and the approval queue (§6, §24).
 *
 * The page reads differently depending on who opens it, because the same
 * collection is two different jobs:
 *
 *   A Super Admin appoints shopkeepers and decides on requests.
 *   A shopkeeper asks for help and waits.
 *
 * Assignable roles and presets come from GET /users/roles rather than being
 * listed here — the previous version hardcoded three role names, and when the
 * roles changed the page silently started sending values the API would reject.
 */
const blank = {
  firstName: '', lastName: '', email: '', phone: '', password: '',
  role: '', shopId: '', preset: '', isActive: true,
};

const APPROVAL_TONE = { approved: 'badge-green', pending: 'badge-orange', rejected: 'badge-red' };

export default function Users() {
  const { user: me, can, isSuperAdmin } = useAuth();
  const canApprove = can(CAPS.USER_APPROVE);

  const [filter, setFilter] = useState('');
  const params = filter ? { approvalStatus: filter } : {};
  const list = usePagedList('/users', { params });

  const [meta, setMeta] = useState({ roles: [], presets: [], requestsNeedApproval: false });
  const [shops, setShops] = useState([]);
  const [pending, setPending] = useState([]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [reviewing, setReviewing] = useState(null);
  const [reviewNote, setReviewNote] = useState('');

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const loadMeta = useCallback(async () => {
    try {
      const { data } = await api.get('/users/roles');
      setMeta(data.data);
    } catch {
      // A failed meta read must not stop the list rendering.
    }
    if (isSuperAdmin) {
      try {
        const { data } = await api.get('/shops', { ...PLATFORM_SCOPE, params: { limit: 200 } });
        setShops(data.data || []);
      } catch { /* the shop selector simply stays empty */ }
    }
  }, [isSuperAdmin]);

  const loadPending = useCallback(async () => {
    if (!canApprove) return;
    try {
      const { data } = await api.get('/users/pending', { params: { limit: 50 } });
      setPending(data.data || []);
    } catch { setPending([]); }
  }, [canApprove]);

  useEffect(() => { loadMeta(); loadPending(); }, [loadMeta, loadPending]);

  const refresh = () => { list.reload(); loadPending(); };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...blank,
      // One assignable role is the common case — a shopkeeper can only request
      // Shop Users — so there is nothing to choose.
      role: meta.roles.length === 1 ? meta.roles[0] : '',
      shopId: isSuperAdmin ? '' : (me?.shopId || ''),
    });
    setError('');
    setOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      firstName: u.firstName || '', lastName: u.lastName || '', email: u.email || '',
      phone: u.phone || '', password: '', role: u.role || '',
      shopId: u.shopId || '', preset: u.preset || '', isActive: u.isActive !== false,
    });
    setError('');
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (!payload.preset) delete payload.preset;
      if (!payload.shopId) delete payload.shopId;

      if (editing) {
        await api.put(`/users/${editing.id}`, payload);
        setNotice(`${form.email} updated.`);
      } else {
        const { data } = await api.post('/users', payload);
        setNotice(data.message);
      }
      setOpen(false);
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const decide = async (verdict) => {
    setSaving(true);
    try {
      const { data } = await api.post(`/users/${reviewing.id}/${verdict}`, { note: reviewNote });
      setNotice(data.message);
      setReviewing(null);
      setReviewNote('');
      refresh();
    } catch (err) {
      window.alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const disable = async (u) => {
    if (!window.confirm(`Disable ${u.email}? They will not be able to sign in.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      refresh();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  };

  const roleBadge = (role) =>
    role === 'Super Admin' ? 'badge-blue' : role === 'Shopkeeper' ? 'badge-green' : 'badge-gray';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{isSuperAdmin ? 'Shopkeepers & users' : 'Shop users'}</h1>
          <div className="sub">
            {isSuperAdmin
              ? 'Appoint one shopkeeper per shop, and decide on the extra help they ask for.'
              : meta.requestsNeedApproval
                ? 'Ask for extra help here. Requests go to the Super Admin, who approves them before anyone can sign in.'
                : 'People who can work in this shop.'}
          </div>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-primary" onClick={openCreate} disabled={meta.roles.length === 0}>
            {isSuperAdmin ? '+ New user' : '+ Request a user'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="alert alert-success">
          <span>✓</span>
          <div style={{ flex: 1 }}>{notice}</div>
          <button className="link-btn small" onClick={() => setNotice('')}>Dismiss</button>
        </div>
      )}

      {/* ── the approval queue, oldest first (§6) ── */}
      {canApprove && pending.length > 0 && (
        <div className="card mb-3" style={{ borderColor: 'var(--warning)' }}>
          <div className="card-head">
            <h2>{pending.length} request{pending.length === 1 ? '' : 's'} waiting</h2>
            <div className="actions small muted">A shopkeeper asked for help — nobody can sign in until you decide</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Person</th><th>Shop</th><th>Asked for</th>
                  <th>Requested by</th><th>When</th><th />
                </tr>
              </thead>
              <tbody>
                {pending.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="strong">{u.fullName}</div>
                      <div className="small muted mono">{u.email}</div>
                    </td>
                    <td className="muted">{u.shopName || '—'}</td>
                    <td>
                      <span className="badge badge-gray">{u.preset || u.role}</span>
                      <div className="small muted">{u.grantedCapabilities?.length || 0} permissions</div>
                    </td>
                    <td className="small muted">
                      {u.requestedBy ? <>{u.requestedBy.name}<div className="mono">{u.requestedBy.email}</div></> : '—'}
                    </td>
                    <td className="muted small nowrap">{dateTime(u.requestedAt || u.createdAt)}</td>
                    <td className="actions-cell">
                      <button className="btn btn-primary btn-sm" onClick={() => { setReviewing({ ...u, verdict: 'approve' }); setReviewNote(''); }}>
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ErrorNote message={list.error} onRetry={list.reload} />

      <div className="card">
        <div className="card-head">
          <div className="seg">
            {[['', 'Everyone'], ['approved', 'Active'], ['pending', 'Waiting'], ['rejected', 'Declined']].map(([k, label]) => (
              <button key={k || 'all'} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>
          <div className="actions">
            <input
              className="search" placeholder="Search name, email or phone…"
              value={list.search} onChange={(e) => list.setSearch(e.target.value)}
              style={{ maxWidth: 280 }}
            />
          </div>
        </div>

        {list.loading ? (
          <Loading />
        ) : list.items.length === 0 ? (
          <Empty
            icon="⚇"
            title={filter ? 'Nobody in this state' : 'No users yet'}
            hint={isSuperAdmin
              ? 'Appoint a shopkeeper from the Shops page, or add one here.'
              : 'Request someone to help you run the shop.'}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Person</th><th>Role</th>
                    {isSuperAdmin && <th>Shop</th>}
                    <th>Status</th><th>Last signed in</th><th />
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-1">
                          <div className="avatar">{initials(u.firstName, u.lastName)}</div>
                          <div>
                            <div className="strong">
                              {u.fullName}
                              {u.id === me?.id && <span className="small muted"> — you</span>}
                            </div>
                            <div className="small muted mono">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${roleBadge(u.role)}`}>{u.role}</span>
                        {u.preset && <div className="small muted">{u.preset}</div>}
                      </td>
                      {isSuperAdmin && <td className="muted">{u.shop?.name || '—'}</td>}
                      <td>
                        <span className={`badge ${APPROVAL_TONE[u.approvalStatus] || 'badge-gray'}`}>
                          {u.approvalStatus === 'approved' && !u.isActive ? 'disabled' : u.approvalStatus}
                        </span>
                        {u.approvalStatus === 'rejected' && u.reviewNote && (
                          <div className="small muted">{u.reviewNote}</div>
                        )}
                      </td>
                      <td className="muted small nowrap">
                        {u.lastLoginAt ? dateTime(u.lastLoginAt) : 'never'}
                      </td>
                      <td className="actions-cell">
                        {canApprove && u.approvalStatus === 'pending' && (
                          <>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => { setReviewing({ ...u, verdict: 'approve' }); setReviewNote(''); }}
                            >
                              Review
                            </button>{' '}
                          </>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>Edit</button>
                        {u.isActive && u.id !== me?.id && u.role !== 'Super Admin' && (
                          <>
                            {' '}
                            <button className="btn btn-ghost btn-sm" onClick={() => disable(u)}>Disable</button>
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

      {/* ── create / request / edit ── */}
      <Modal
        open={open}
        title={editing ? `Edit ${editing.fullName}` : isSuperAdmin ? 'New user' : 'Request a user'}
        onClose={() => setOpen(false)}
        wide
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving
                ? <><span className="spinner" /> Saving…</>
                : editing ? 'Save changes' : isSuperAdmin ? 'Create user' : 'Submit request'}
            </button>
          </>
        }
      >
        <form onSubmit={save}>
          {error && <div className="alert alert-error"><span>⚠</span><div>{error}</div></div>}

          {!editing && meta.requestsNeedApproval && (
            <div className="alert alert-info">
              <span>⏳</span>
              <div>
                This creates the account straight away, but it stays locked until the Super Admin
                approves it. You will see it as <strong>waiting</strong> in the list until then.
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="field">
              <label>First name *</label>
              <input value={form.firstName} onChange={set('firstName')} required autoFocus />
            </div>
            <div className="field">
              <label>Last name</label>
              <input value={form.lastName} onChange={set('lastName')} />
            </div>
          </div>

          <div className="field">
            <label>Email *</label>
            <input type="email" value={form.email} onChange={set('email')} required />
          </div>

          <div className="form-row">
            <div className="field">
              <label>Phone</label>
              <input value={form.phone} onChange={set('phone')} />
            </div>
            <div className="field">
              <label>Role *</label>
              <select value={form.role} onChange={set('role')} required disabled={meta.roles.length <= 1}>
                {meta.roles.length !== 1 && <option value="">Select a role…</option>}
                {meta.roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {form.role === 'Shopkeeper' && (
                <div className="hint">A shop has exactly one — the API refuses a second.</div>
              )}
            </div>
          </div>

          {isSuperAdmin && (
            <div className="field">
              <label>Shop *</label>
              <select value={form.shopId} onChange={set('shopId')} required>
                <option value="">Select the shop they work in…</option>
                {shops.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.code}){s.market?.name ? ` — ${s.market.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.role !== 'Shopkeeper' && meta.presets.length > 0 && (
            <div className="field">
              <label>What will they do?</label>
              <select value={form.preset} onChange={set('preset')}>
                <option value="">Just sell — the default</option>
                {meta.presets.map((p) => <option key={p.name} value={p.name}>{p.label}</option>)}
              </select>
              <div className="hint">
                A starting point, not a fixed role. Permissions can be adjusted per person afterwards.
              </div>
            </div>
          )}

          <div className="field">
            <label>{editing ? 'New password' : 'Password *'}</label>
            <input
              type="text" value={form.password} onChange={set('password')}
              required={!editing} minLength={6}
              placeholder={editing ? 'Leave blank to keep the current password' : 'At least 6 characters'}
            />
            {!editing && <div className="hint">Shown as you type — pass it on, and have them change it.</div>}
          </div>

          {editing && (
            <label className="flex items-center" style={{ fontWeight: 500 }}>
              <input
                type="checkbox" checked={form.isActive} onChange={set('isActive')}
                style={{ width: 'auto', marginRight: 6 }}
              />
              Active — allowed to sign in
            </label>
          )}
        </form>
      </Modal>

      {/* ── approve or decline ── */}
      <Modal
        open={Boolean(reviewing)}
        title={reviewing ? `Review ${reviewing.fullName}` : 'Review'}
        onClose={() => setReviewing(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setReviewing(null)} disabled={saving}>Close</button>
            <button
              className="btn btn-ghost" style={{ color: 'var(--danger)' }}
              onClick={() => decide('reject')} disabled={saving}
            >
              Decline
            </button>
            <button className="btn btn-primary" onClick={() => decide('approve')} disabled={saving}>
              {saving ? <><span className="spinner" /> Saving…</> : 'Approve'}
            </button>
          </>
        }
      >
        {reviewing && (
          <>
            <div className="form-row">
              <div>
                <div className="small muted">Person</div>
                <div className="strong">{reviewing.fullName}</div>
                <div className="small mono muted">{reviewing.email}</div>
              </div>
              <div>
                <div className="small muted">Shop</div>
                <div className="strong">{reviewing.shopName || reviewing.shop?.name || '—'}</div>
              </div>
              <div>
                <div className="small muted">Asked for</div>
                <div className="strong">{reviewing.preset || reviewing.role}</div>
              </div>
            </div>

            {reviewing.requestedBy && (
              <div className="small muted mt-2">
                Requested by {reviewing.requestedBy.name} ({reviewing.requestedBy.email})
              </div>
            )}

            <div className="alert alert-info mt-3">
              <span>🔑</span>
              <div>
                Approving lets them sign in to <strong>{reviewing.shopName || 'their shop'}</strong> only,
                with {reviewing.grantedCapabilities?.length || 0} permissions. They can see nothing in
                any other shop.
              </div>
            </div>

            <div className="field">
              <label>Note</label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                maxLength={500}
                placeholder="Optional — kept with the record, and shown to the shopkeeper if you decline."
              />
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
