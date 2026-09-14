import { useState } from 'react';
import api, { errorMessage, CAPS } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ReadOnly from '../components/ReadOnly.jsx';
import usePagedList from '../hooks/usePagedList.js';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import { money } from '../utils/format.js';

const blank = { name: '', contactPerson: '', phone: '', email: '', address: '', isActive: true };

export default function Suppliers() {
  const { can } = useAuth();
  const canManage = can(CAPS.SUPPLIER_MANAGE);
  const list = usePagedList('/suppliers');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const openCreate = () => { setEditing(null); setForm(blank); setError(''); setOpen(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name || '', contactPerson: s.contactPerson || '', phone: s.phone || '',
      email: s.email || '', address: s.address || '', isActive: s.isActive !== false,
    });
    setError('');
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) await api.put(`/suppliers/${editing._id}`, form);
      else await api.post('/suppliers', form);
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
          <h1>Suppliers</h1>
          <div className="sub">Who you buy from, and what you owe them</div>
        </div>
        <div className="page-head-actions">
          {canManage && <button className="btn btn-primary" onClick={openCreate}>+ New supplier</button>}
        </div>
      </div>

      {!canManage && <ReadOnly what="Suppliers" />}

      <ErrorNote message={list.error} onRetry={list.reload} />

      <div className="card">
        <div className="card-head">
          <input
            className="search" placeholder="Search by name, contact or phone…"
            value={list.search} onChange={(e) => list.setSearch(e.target.value)}
            style={{ maxWidth: 340 }}
          />
        </div>

        {list.loading ? (
          <Loading />
        ) : list.items.length === 0 ? (
          <Empty icon="⛬" title={list.search ? 'No suppliers match' : 'No suppliers yet'} hint="Add a supplier to record purchases against." />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Contact person</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th className="num">Balance owed</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((s) => (
                    <tr key={s._id}>
                      <td className="strong">{s.name}</td>
                      <td className="muted">{s.contactPerson || '—'}</td>
                      <td className="muted">{s.phone || '—'}</td>
                      <td className="muted">{s.email || '—'}</td>
                      <td className="num">
                        {s.balance > 0 ? <span className="badge badge-orange">{money(s.balance)}</span> : <span className="muted">—</span>}
                      </td>
                      <td>
                        <span className={`badge ${s.isActive ? 'badge-green' : 'badge-gray'}`}>
                          {s.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="actions-cell">
                        {canManage && (
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>Edit</button>
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
        title={editing ? `Edit ${editing.name}` : 'New supplier'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <><span className="spinner" /> Saving…</> : editing ? 'Save changes' : 'Create supplier'}
            </button>
          </>
        }
      >
        <form onSubmit={save}>
          {error && <div className="alert alert-error"><span>⚠</span><div>{error}</div></div>}
          <div className="field">
            <label>Supplier name *</label>
            <input value={form.name} onChange={set('name')} required autoFocus />
          </div>
          <div className="field">
            <label>Contact person</label>
            <input value={form.contactPerson} onChange={set('contactPerson')} />
          </div>
          <div className="form-row">
            <div className="field">
              <label>Phone</label>
              <input value={form.phone} onChange={set('phone')} />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={set('email')} />
            </div>
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
