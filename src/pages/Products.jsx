import { useEffect, useState } from 'react';
import api, { errorMessage, CAPS } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ReadOnly from '../components/ReadOnly.jsx';
import usePagedList from '../hooks/usePagedList.js';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import { money, number } from '../utils/format.js';
import { CostUnlockButton } from '../components/CostUnlock.jsx';
import useCostRefresh from '../hooks/useCostRefresh.js';

const blank = {
  sku: '', name: '', barcode: '', itemNumber: '', description: '',
  category: '', brand: '', model: '', compatibleModels: [],
  technology: '', assemblyType: '', quality: '', color: '',
  unit: 'pcs',
  purchasePrice: '', salePrice: '', wholesalePrice: '',
  quantity: 0, minimumStock: 0, maximumStock: 0,
  location: { rack: '', shelf: '', bin: '' },
  isActive: true,
  isPublic: false,
};

export default function Products() {
  // Reading a cost needs the unlock; *writing* an opening cost does not, so the
  // form and the table answer to different questions.
  const list = usePagedList('/products');
  const { canUnlock, unlocked } = useCostRefresh(list.reload);

  // Product management belongs to the shopkeeper (§11, §39). The Super Admin
  // holds product.view and none of the write capabilities, so the buttons follow
  // the capability rather than the page — otherwise this offers three actions the
  // API answers with 403.
  const { can } = useAuth();
  const canCreate = can(CAPS.PRODUCT_CREATE);
  const canUpdate = can(CAPS.PRODUCT_UPDATE);
  const canDelete = can(CAPS.PRODUCT_DELETE);
  const canPublish = can(CAPS.PRODUCT_PUBLISH);
  const readOnly = !canCreate && !canUpdate && !canDelete;
  const showCost = unlocked;
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [options, setOptions] = useState({ technologies: [], assemblyTypes: [], qualities: [], colors: [] });
  const [parsing, setParsing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/categories'), api.get('/brands'),
      api.get('/models', { params: { limit: 500 } }), api.get('/products/options'),
    ])
      .then(([c, b, m, o]) => {
        setCategories(c.data.data || []);
        setBrands(b.data.data || []);
        setModels(m.data.data || []);
        setOptions(o.data.data || {});
      })
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(blank);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      sku: p.sku || '',
      name: p.name || '',
      barcode: p.barcode || '',
      itemNumber: p.itemNumber || '',
      description: p.description || '',
      category: p.category?._id || p.category || '',
      brand: p.brand?._id || p.brand || '',
      model: p.model?._id || p.model || '',
      compatibleModels: (p.compatibleModels || []).map((m) => m._id || m),
      technology: p.technology || '',
      assemblyType: p.assemblyType || '',
      quality: p.quality || '',
      color: p.color || '',
      location: { rack: p.location?.rack || '', shelf: p.location?.shelf || '', bin: p.location?.bin || '' },
      unit: p.unit || 'pcs',
      purchasePrice: p.purchasePrice ?? '',
      salePrice: p.salePrice ?? '',
      wholesalePrice: p.wholesalePrice ?? '',
      quantity: p.quantity ?? 0,
      minimumStock: p.minimumStock ?? 0,
      maximumStock: p.maximumStock ?? 0,
      isActive: p.isActive !== false,
      isPublic: p.isPublic === true,
    });
    setFormError('');
    setModalOpen(true);
  };

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  /** Asks the backend to decode a typed name; the user confirms each field. */
  const suggestFromName = async () => {
    if (!form.name.trim()) return;
    setParsing(true);
    try {
      const { data } = await api.post('/products/parse-name', { name: form.name });
      const p = data.data;
      const matchModel = (label) =>
        models.find((m) => m.name === String(label).toUpperCase()
          || (m.aliases || []).includes(String(label).toUpperCase()));

      const primary = p.models[0] ? matchModel(p.models[0]) : null;
      const compatible = p.models.slice(1).map(matchModel).filter(Boolean);
      const brandMatch = p.brandCandidates.length === 1
        ? brands.find((b) => b.name.toLowerCase() === p.brandCandidates[0].toLowerCase())
        : null;
      const categoryMatch = p.partType ? categories.find((c) => c.name === p.partType) : null;

      setForm((f) => ({
        ...f,
        technology: p.technology || f.technology,
        color: p.color || f.color,
        quality: p.quality || f.quality,
        sku: f.sku || data.data.suggestedSku,
        brand: brandMatch?._id || f.brand,
        category: categoryMatch?._id || f.category,
        model: primary?._id || f.model,
        compatibleModels: compatible.length ? compatible.map((m) => m._id) : f.compatibleModels,
      }));

      if (p.brandCandidates.length > 1) {
        setFormError(`Brand could be ${p.brandCandidates.join(' or ')} — pick the right one below.`);
      }
    } catch {
      // suggestion is optional; a failure should not block the form
    } finally {
      setParsing(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        ...form,
        purchasePrice: Number(form.purchasePrice || 0),
        salePrice: Number(form.salePrice || 0),
        wholesalePrice: Number(form.wholesalePrice || 0),
        quantity: Number(form.quantity || 0),
        minimumStock: Number(form.minimumStock || 0),
        maximumStock: Number(form.maximumStock || 0),
      };
      if (editing) {
        delete payload.quantity; // stock changes go through Inventory → Adjust
        await api.put(`/products/${editing._id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      setModalOpen(false);
      list.reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Put a product on the consumer marketplace, or take it off.
   *
   * The API answers with whether the listing is actually *visible*, not just
   * whether the flag was set — a product in a shop that is not itself public
   * stays hidden, and the shopkeeper needs to be told that rather than left
   * wondering why nothing appeared.
   */
  const togglePublish = async (p) => {
    try {
      const res = await api.patch(`/products/${p._id}/publish`, { isPublic: !p.isPublic });
      const { visible, blockers = [] } = res.data.data || {};
      if (!p.isPublic && !visible && blockers.length) window.alert(res.data.message);
      list.reload();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  };

  const deactivate = async (p) => {
    if (!window.confirm(`Deactivate "${p.name}"? It will be hidden from active listings.`)) return;
    try {
      await api.delete(`/products/${p._id}`);
      list.reload();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <div className="sub">Catalog of parts and accessories you buy and sell</div>
        </div>
        <div className="page-head-actions">
          {canCreate && <button className="btn btn-primary" onClick={openCreate}>
            + New product
          </button>}
        </div>
      </div>

      {readOnly && <ReadOnly what="Products" />}

      <ErrorNote message={list.error} onRetry={list.reload} />

      <div className="card">
        <div className="card-head">
          <div className="toolbar" style={{ flex: 1 }}>
            <input
              className="search"
              placeholder="Search by name, SKU or barcode…"
              value={list.search}
              onChange={(e) => list.setSearch(e.target.value)}
            />
          </div>
        </div>

        {list.loading ? (
          <Loading />
        ) : list.items.length === 0 ? (
          <Empty
            icon="▣"
            title={list.search ? 'No products match your search' : 'No products yet'}
            hint={list.search ? 'Try a different term.' : 'Add your first product to get started.'}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Brand</th>
                    {canUnlock && (
                      <th className="num">
                        {showCost ? 'Cost' : <CostUnlockButton compact />}
                      </th>
                    )}
                    <th className="num">Price</th>
                    <th className="num">Stock</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((p) => {
                    const low = p.quantity <= p.minimumStock;
                    return (
                      <tr key={p._id}>
                        <td className="mono">{p.sku}</td>
                        <td>
                          <div className="strong">{p.name}</div>
                          <div className="small muted">
                            {p.technology && <span className="badge badge-gray" style={{ marginRight: 4 }}>{p.technology}</span>}
                            {p.model?.name || ''}
                            {p.compatibleModels?.length > 0 && ` +${p.compatibleModels.length} models`}
                          </div>
                        </td>
                        <td className="muted">{p.category?.name || '—'}</td>
                        <td className="muted">{p.brand?.name || '—'}</td>
                        {canUnlock && (
                          <td className="num muted">{showCost ? money(p.purchasePrice) : '••••'}</td>
                        )}
                        <td className="num strong">{money(p.salePrice)}</td>
                        <td className="num">
                          <span className={`badge ${low ? 'badge-red' : 'badge-gray'}`}>
                            {number(p.quantity)} {p.unit}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${p.isActive ? 'badge-green' : 'badge-gray'}`}>
                            {p.isActive ? 'Active' : 'Inactive'}
                          </span>
                          {' '}
                          {/* Whether a consumer can see this listing at all.
                              Shown to everyone who can view products, because
                              "why is this not on the shop page?" is the
                              question the badge exists to answer. */}
                          <span
                            className={`badge ${p.isPublic ? 'badge-blue' : 'badge-gray'}`}
                            title={p.isPublic
                              ? 'Listed on the consumer marketplace'
                              : 'Not published — consumers cannot see this'}
                          >
                            {p.isPublic ? 'Published' : 'Private'}
                          </span>
                        </td>
                        <td className="actions-cell">
                          {/* A read-only viewer still needs to open a product —
                              the same modal, with saving withheld. */}
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>
                            {canUpdate ? 'Edit' : 'View'}
                          </button>
                          {canPublish && p.isActive && (
                            <>
                              {' '}
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => togglePublish(p)}
                                title={p.isPublic
                                  ? 'Remove from the consumer marketplace'
                                  : 'Show this product to consumers'}
                              >
                                {p.isPublic ? 'Unpublish' : 'Publish'}
                              </button>
                            </>
                          )}
                          {canDelete && p.isActive && (
                            <>
                              {' '}
                              <button className="btn btn-ghost btn-sm" onClick={() => deactivate(p)}>
                                Disable
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination pagination={list.pagination} onPage={list.setPage} />
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? `${canUpdate ? 'Edit' : ''} ${editing.name}`.trim() : 'New product'}
        onClose={() => setModalOpen(false)}
        wide
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              {canUpdate || !editing ? 'Cancel' : 'Close'}
            </button>
            {/* No save button at all for a viewer, rather than one that 403s. */}
            {(editing ? canUpdate : canCreate) && (
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <><span className="spinner" /> Saving…</> : editing ? 'Save changes' : 'Create product'}
              </button>
            )}
          </>
        }
      >
        <form onSubmit={save}>
          {formError && (
            <div className="alert alert-error">
              <span>⚠</span>
              <div>{formError}</div>
            </div>
          )}

          <div className="form-row">
            <div className="field">
              <label>SKU *</label>
              <input value={form.sku} onChange={set('sku')} placeholder="APL-IP14-DISP" required />
            </div>
            <div className="field">
              <label>Barcode</label>
              <input value={form.barcode} onChange={set('barcode')} placeholder="8901234567890" />
            </div>
          </div>

          <div className="field">
            <label>Product name *</label>
            <div className="flex gap-1">
              <input value={form.name} onChange={set('name')}
                     placeholder="MI NOTE 11 INCELL PANEL" required style={{ flex: 1 }} />
              <button type="button" className="btn btn-ghost" onClick={suggestFromName}
                      disabled={parsing || !form.name.trim()} title="Decode brand, model and technology from the name">
                {parsing ? <span className="spinner" /> : 'Decode'}
              </button>
            </div>
            <div className="hint">
              Decode reads the name the way the counter writes it — "MI 15C/POCO C85 K-COMBO PANEL" —
              and fills in the fields below for you to confirm.
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Model</label>
              <select value={form.model} onChange={set('model')}>
                <option value="">— none —</option>
                {models.map((m) => <option key={m._id} value={m._id}>{m.brandName} {m.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Technology</label>
              <select value={form.technology} onChange={set('technology')}>
                <option value="">— none —</option>
                {options.technologies?.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Quality</label>
              <select value={form.quality} onChange={set('quality')}>
                <option value="">— none —</option>
                {options.qualities?.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Also fits these models</label>
            <select
              multiple
              value={form.compatibleModels}
              onChange={(e) => setForm((f) => ({
                ...f, compatibleModels: [...e.target.selectedOptions].map((o) => o.value),
              }))}
              style={{ height: 96 }}
            >
              {models.map((m) => <option key={m._id} value={m._id}>{m.brandName} {m.name}</option>)}
            </select>
            <div className="hint">
              Hold ⌘ to pick several. Searching any of these models will return this product —
              this is the invoice's "X6816/X6817" written properly.
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Category</label>
              <select value={form.category} onChange={set('category')}>
                <option value="">— none —</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Brand</label>
              <select value={form.brand} onChange={set('brand')}>
                <option value="">— none —</option>
                {brands.map((b) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Unit</label>
              <input value={form.unit} onChange={set('unit')} placeholder="pcs" />
            </div>
          </div>

          <div className="form-row">
            {canUnlock && (editing ? unlocked : true) && (
              <div className="field">
                <label>{editing ? 'Average cost' : 'Opening cost'}</label>
                <input type="number" step="0.01" min="0" value={form.purchasePrice}
                       onChange={set('purchasePrice')} disabled={Boolean(editing)} />
                <div className="hint">
                  {editing
                    ? 'Maintained by weighted average — it changes when you receive a purchase.'
                    : 'Starting cost for the opening stock.'}
                </div>
              </div>
            )}
            {canUnlock && editing && !unlocked && (
              <div className="field">
                <label>Average cost</label>
                <div style={{ padding: '8px 0' }}><CostUnlockButton label="Show average cost" /></div>
                <div className="hint">Maintained by weighted average — it is read-only either way.</div>
              </div>
            )}
            <div className="field">
              <label>Sale price *</label>
              <input type="number" step="0.01" min="0" value={form.salePrice} onChange={set('salePrice')} required />
            </div>
            <div className="field">
              <label>Wholesale price</label>
              <input type="number" step="0.01" min="0" value={form.wholesalePrice} onChange={set('wholesalePrice')} />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Rack</label>
              <input value={form.location.rack}
                     onChange={(e) => setForm((f) => ({ ...f, location: { ...f.location, rack: e.target.value } }))} />
            </div>
            <div className="field">
              <label>Shelf</label>
              <input value={form.location.shelf}
                     onChange={(e) => setForm((f) => ({ ...f, location: { ...f.location, shelf: e.target.value } }))} />
            </div>
            <div className="field">
              <label>Item number</label>
              <input value={form.itemNumber} onChange={set('itemNumber')} />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>{editing ? 'Current stock' : 'Opening stock'}</label>
              <input type="number" value={form.quantity} onChange={set('quantity')} disabled={Boolean(editing)} />
              {editing && <div className="hint">Change stock from Inventory → Adjust so the movement is logged.</div>}
            </div>
            <div className="field">
              <label>Minimum stock</label>
              <input type="number" min="0" value={form.minimumStock} onChange={set('minimumStock')} />
              <div className="hint">Low-stock alerts trigger at or below this.</div>
            </div>
            <div className="field">
              <label>Maximum stock</label>
              <input type="number" min="0" value={form.maximumStock} onChange={set('maximumStock')} />
            </div>
          </div>

          <div className="field">
            <label>Description</label>
            <textarea value={form.description} onChange={set('description')} placeholder="Optional notes about this product" />
          </div>

          <label className="flex items-center gap-1" style={{ fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={set('isActive')}
              style={{ width: 'auto', marginRight: 6 }}
            />
            Active — available for sales and purchases
          </label>

          {/* Publishing is a separate permission from editing, so the control
              only appears for someone who actually holds it. Without this the
              consumer marketplace can never be populated: isPublic defaults to
              false and nothing in the panel could ever turn it on. */}
          {canPublish && (
            <label className="flex items-center gap-1" style={{ fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={set('isPublic')}
                style={{ width: 'auto', marginRight: 6 }}
              />
              Publish — show this product to consumers on the marketplace
            </label>
          )}
        </form>
      </Modal>
    </>
  );
}
