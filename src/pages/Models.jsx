import { useEffect, useState } from 'react';
import api, { errorMessage, CAPS } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';

/**
 * Brand and model masters. Aliases matter more than they look: the same
 * handset is written several ways across the counter, and every spelling
 * listed here becomes searchable on the products that reference it.
 */
export default function Models() {
  const { can } = useAuth();
  const editable = can(CAPS.PRODUCT_CREATE);

  const [groups, setGroups] = useState([]);
  const [brands, setBrands] = useState([]);
  const [state, setState] = useState({ loading: true, error: '' });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ brandId: '', name: '', aliases: '', series: '' });
  const [brandOpen, setBrandOpen] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setState({ loading: true, error: '' });
    try {
      const [g, b] = await Promise.all([api.get('/models/by-brand'), api.get('/brands')]);
      setGroups(g.data.data || []);
      setBrands(b.data.data || []);
      setState({ loading: false, error: '' });
    } catch (err) { setState({ loading: false, error: errorMessage(err) }); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = (brandId = '') => {
    setEditing(null); setForm({ brandId, name: '', aliases: '', series: '' }); setError(''); setOpen(true);
  };
  const openEdit = (brandId, m) => {
    setEditing(m);
    setForm({ brandId, name: m.name, aliases: (m.aliases || []).join(', '), series: m.series || '' });
    setError(''); setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    const payload = {
      brandId: form.brandId,
      name: form.name,
      aliases: form.aliases.split(',').map((a) => a.trim()).filter(Boolean),
      series: form.series,
    };
    try {
      if (editing) await api.put(`/models/${editing._id}`, payload);
      else await api.post('/models', payload);
      setOpen(false); load();
    } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); }
  };

  const saveBrand = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/brands', { name: brandName });
      setBrandOpen(false); setBrandName(''); load();
    } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); }
  };

  if (state.loading) return <Loading label="Loading brands and models…" />;

  const totalModels = groups.reduce((s, g) => s + g.count, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Brands & models</h1>
          <div className="sub">
            {brands.length} brands, {totalModels} models — aliases make every spelling searchable
          </div>
        </div>
        {editable && (
          <div className="page-head-actions">
            <button className="btn btn-ghost" onClick={() => { setBrandName(''); setError(''); setBrandOpen(true); }}>
              + Brand
            </button>
            <button className="btn btn-primary" onClick={() => openCreate()}>+ Model</button>
          </div>
        )}
      </div>

      <ErrorNote message={state.error} onRetry={load} />

      {groups.length === 0 ? (
        <div className="card">
          <Empty icon="⌸" title="No models yet"
                 hint="Add the handsets you stock parts for, so products can be found by model." />
        </div>
      ) : (
        <div className="grid grid-2">
          {groups.map((g) => (
            <div className="card" key={g._id}>
              <div className="card-head">
                <h2>{g.brandName}</h2>
                <div className="actions">
                  <span className="badge badge-gray">{g.count}</span>
                  {editable && (
                    <button className="btn btn-ghost btn-sm" onClick={() => openCreate(g._id)}>+ Model</button>
                  )}
                </div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {g.models.map((m) => (
                  <button
                    key={m._id}
                    className="badge badge-blue"
                    onClick={() => editable && openEdit(g._id, m)}
                    title={m.aliases?.length ? `also: ${m.aliases.join(', ')}` : 'no aliases'}
                    style={{ border: 'none', cursor: editable ? 'pointer' : 'default', fontFamily: 'inherit' }}
                  >
                    {m.name}
                    {m.aliases?.length > 0 && <span style={{ opacity: 0.65 }}>+{m.aliases.length}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open} title={editing ? `Edit ${editing.name}` : 'New model'} onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <><span className="spinner" /> Saving…</> : editing ? 'Save' : 'Add model'}
            </button>
          </>
        }
      >
        <form onSubmit={save}>
          {error && <div className="alert alert-error"><span>⚠</span><div>{error}</div></div>}
          <div className="field">
            <label>Brand *</label>
            <select value={form.brandId} onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value }))}
                    required disabled={Boolean(editing)}>
              <option value="">Select a brand…</option>
              {brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Model name *</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                   required placeholder="NOTE 11" style={{ textTransform: 'uppercase' }} autoFocus />
          </div>
          <div className="field">
            <label>Also known as</label>
            <input value={form.aliases} onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))}
                   placeholder="MI NOTE 11, REDMI NOTE 11" />
            <div className="hint">
              Comma separated. Searching any of these finds the products built against this model.
            </div>
          </div>
          <div className="field">
            <label>Series</label>
            <input value={form.series} onChange={(e) => setForm((f) => ({ ...f, series: e.target.value }))}
                   placeholder="Note series" />
          </div>
        </form>
      </Modal>

      <Modal
        open={brandOpen} title="New brand" onClose={() => setBrandOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setBrandOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={saveBrand} disabled={saving}>
              {saving ? <><span className="spinner" /> Saving…</> : 'Add brand'}
            </button>
          </>
        }
      >
        <form onSubmit={saveBrand}>
          {error && <div className="alert alert-error"><span>⚠</span><div>{error}</div></div>}
          <div className="field">
            <label>Brand name *</label>
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} required autoFocus
                   placeholder="Redmi" />
          </div>
        </form>
      </Modal>
    </>
  );
}
