import { useState } from 'react';
import api, { errorMessage, CAPS } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ReadOnly from '../components/ReadOnly.jsx';
import usePagedList from '../hooks/usePagedList.js';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import { money } from '../utils/format.js';

const blank = { name: '', phone: '', email: '', address: '', creditLimit: 0, isActive: true };

export default function Customers() {
  const { can } = useAuth();
  const canManage = can(CAPS.CUSTOMER_MANAGE);
  const list = usePagedList('/customers');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const openCreate = () => { setEditing(null); setForm(blank); setError(''); setOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name || '', phone: c.phone || '', email: c.email || '',
      address: c.address || '', creditLimit: c.creditLimit ?? 0, isActive: c.isActive !== false,
    });
    setError('');
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = { ...form, creditLimit: Number(form.creditLimit || 0) };
      if (editing) await api.put(`/customers/${editing._id}`, payload);
      else await api.post('/customers', payload);
      setOpen(false);
      list.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <div className="sub">Who you sell to, and what they owe you</div>
        </div>
        <div className="page-head-actions">
          {canManage && <button className="btn btn-primary" onClick={openCreate}>+ New customer</button>}
        </div>
      </div>

      {!canManage && <ReadOnly what="Customers" />}

      <ErrorNote message={list.error} onRetry={list.reload} />

      <div className="card">
        <div className="card-head">
          <input
            className="search" placeholder="Search by name, phone or email…"
            value={list.search} onChange={(e) => list.setSearch(e.target.value)}
            style={{ maxWidth: 340 }}
          />
        </div>

        {list.loading ? (
          <Loading />
        ) : list.items.length === 0 ? (
          <Empty icon="☺" title={list.search ? 'No customers match' : 'No customers yet'} hint="Add a customer to track credit sales." />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th className="num">Credit limit</th>
                    <th className="num">Balance owed</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((c) => (
                    <tr key={c._id}>
                      <td className="strong">{c.name}</td>
                      <td className="muted">{c.phone || '—'}</td>
                      <td className="muted">{c.email || '—'}</td>
                      <td className="num muted">{money(c.creditLimit)}</td>
                      <td className="num">
                        {c.balance > 0 ? (
                          <span className="badge badge-orange">{money(c.balance)}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${c.isActive ? 'badge-green' : 'badge-gray'}`}>
                          {c.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="actions-cell">
                        {canManage && (
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>Edit</button>
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

      <Modal
        open={open}
        title={editing ? `Edit ${editing.name}` : 'New customer'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <><span className="spinner" /> Saving…</> : editing ? 'Save changes' : 'Create customer'}
            </button>
          </>
        }
      >
        <form onSubmit={save}>
          {error && <div className="alert alert-error"><span>⚠</span><div>{error}</div></div>}
          <div className="field">
            <label>Name *</label>
            <input value={form.name} onChange={set('name')} required autoFocus />
          </div>
          <div className="form-row">
            <div className="field">
              <label>Phone</label>
              <input value={form.phone} onChange={set('phone')} placeholder="+92 300 1234567" />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={set('email')} />
            </div>
          </div>
          <div className="field">
            <label>Credit limit</label>
            <input type="number" step="0.01" min="0" value={form.creditLimit} onChange={set('creditLimit')} />
            <div className="hint">Maximum unpaid balance you allow this customer.</div>
          </div>
          <div className="field">
            <label>Address</label>
            <textarea value={form.address} onChange={set('address')} />
          </div>
          <label className="flex items-center" style={{ fontWeight: 500 }}>
            <input type="checkbox" checked={form.isActive} onChange={set('isActive')} style={{ width: 'auto', marginRight: 6 }} />
            Active
          </label>
        </form>
      </Modal>
    </>
  );
}
