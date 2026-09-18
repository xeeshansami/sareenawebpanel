import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage, CAPS } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ReadOnly from '../components/ReadOnly.jsx';
import usePagedList from '../hooks/usePagedList.js';
import Modal from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { Loading, Empty, ErrorNote } from '../components/States.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { money, number } from '../utils/format.js';

/**
 * Products — the shop's own catalogue.
 *
 * The form is eleven fields, five of them dropdowns fed from this shop's master
 * data. What used to be on it and is gone: SKU (generated now), barcode,
 * compatible models, assembly type, colour, variant, unit, wholesale and retail
 * price, minimum and maximum stock, shelf location, default supplier and notes.
 *
 * Gone from the form and from the payload, not hidden with CSS — a field the
 * user cannot see but the client still sends is the version of this that goes
 * wrong quietly.
 *
 * "Serial Number" is Product.itemNumber. SKU is derived by the backend from the
 * brand, model and technology, which is also how the invoice importer matches a
 * re-delivery to a part already in the catalogue.
 */

const EMPTY_OPTIONS = {
  brands: [], models: [], accessoryTypes: [], qualities: [], technologies: [],
  partCompanies: [],
};

/**
 * The five lists, guaranteed to be arrays.
 *
 * This page used to assign the response straight into state, which meant it
 * trusted the server to send exactly five named arrays. An API that answered
 * with anything else — an older deployment, a partial response, a future rename
 * — produced `options.brands.length` on `undefined`, and a render-time
 * TypeError unmounts the whole tree: the symptom is a page that loads and then
 * goes blank, with the real cause only visible in the console.
 *
 * Merging into a known shape costs nothing and makes the failure a message
 * instead of a white screen.
 */
function normalizeOptions(data) {
  const arrayOf = (v) => (Array.isArray(v) ? v : []);
  return {
    brands: arrayOf(data?.brands),
    models: arrayOf(data?.models),
    accessoryTypes: arrayOf(data?.accessoryTypes),
    qualities: arrayOf(data?.qualities),
    technologies: arrayOf(data?.technologies),
    partCompanies: arrayOf(data?.partCompanies),
  };
}

const blank = {
  name: '',
  itemNumber: '',
  brand: '',
  model: '',
  category: '',
  quality: '',
  technology: '',
  partCompany: '',
  quantity: 0,
  purchasePrice: '',
  salePrice: '',
  description: '',
  isActive: true,
  isPublic: false,
};

export default function Products() {
  const list = usePagedList('/products');
  const { can } = useAuth();

  const canCreate = can(CAPS.PRODUCT_CREATE);
  const canUpdate = can(CAPS.PRODUCT_UPDATE);
  const canDelete = can(CAPS.PRODUCT_DELETE);
  const canPublish = can(CAPS.PRODUCT_PUBLISH);
  const readOnly = !canCreate && !canUpdate && !canDelete;

  /**
   * Every dropdown, in one request.
   *
   * The form cannot be usefully shown until all five have arrived, so five
   * separate calls would only mean five chances to be half-rendered.
   */
  const [options, setOptions] = useState(EMPTY_OPTIONS);
  const [optionsError, setOptionsError] = useState('');

  const loadOptions = () => {
    api.get('/products/options')
      .then(({ data }) => {
        const next = normalizeOptions(data.data);
        setOptions(next);
        // An older deployment answers this route with the pre-change shape —
        // four hardcoded vocabularies, no brands and no models. That is not an
        // empty shop, it is the wrong server, and saying so beats an empty form.
        setOptionsError(
          next.brands.length === 0 && data.data && !('brands' in data.data)
            ? 'This API is an older version that does not know about brands and '
              + 'models yet. Deploy the current backend, or point '
              + 'VITE_API_BASE_URL at one that is up to date.'
            : ''
        );
      })
      .catch((err) => setOptionsError(errorMessage(err)));
  };

  useEffect(loadOptions, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  /**
   * Choosing Apple must not leave a Samsung model selected.
   *
   * The backend refuses that pairing outright, so filtering here is not the
   * enforcement — it is what stops the shopkeeper being shown a choice that
   * will be rejected after they press save.
   */
  const modelsForBrand = useMemo(() => {
    if (!form.brand) return options.models;
    return options.models.filter((m) => String(m.brand) === String(form.brand));
  }, [options.models, form.brand]);

  const openCreate = () => {
    setEditing(null);
    setForm(blank);
    setFormError('');
    setModalOpen(true);
  };

  const idOf = (v) => (v && typeof v === 'object' ? v._id : v) || '';

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name || '',
      itemNumber: p.itemNumber || '',
      brand: idOf(p.brand),
      model: idOf(p.model),
      category: idOf(p.category),
      quality: idOf(p.quality),
      technology: idOf(p.technology),
      partCompany: idOf(p.partCompany),
      quantity: p.quantity ?? 0,
      purchasePrice: p.purchasePrice ?? '',
      salePrice: p.salePrice ?? '',
      description: p.description || '',
      isActive: p.isActive !== false,
      isPublic: p.isPublic === true,
    });
    setFormError('');
    setModalOpen(true);
  };

  const set = (key) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => {
      // Changing the brand drops a model that no longer belongs to it.
      if (key === 'brand' && f.model) {
        const stillValid = options.models.some(
          (m) => String(m._id) === String(f.model) && String(m.brand) === String(v)
        );
        if (!stillValid) return { ...f, brand: v, model: '' };
      }
      return { ...f, [key]: v };
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: form.name,
        itemNumber: form.itemNumber,
        description: form.description,
        brand: form.brand || null,
        model: form.model || null,
        category: form.category || null,
        quality: form.quality || null,
        technology: form.technology || null,
        partCompany: form.partCompany || null,
        purchasePrice: Number(form.purchasePrice || 0),
        salePrice: Number(form.salePrice || 0),
        isActive: form.isActive,
        isPublic: form.isPublic,
      };

      if (editing) {
        // Stock moves through purchases, sales and logged adjustments — never
        // by re-saving the form.
        await api.put(`/products/${editing._id}`, payload);
      } else {
        await api.post('/products', { ...payload, quantity: Number(form.quantity || 0) });
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
    if (!window.confirm(`Disable "${p.name}"? It will be hidden from active listings.`)) return;
    try {
      await api.delete(`/products/${p._id}`);
      list.reload();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  };

  const noMasterData = options.brands.length === 0 && options.accessoryTypes.length === 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <div className="sub">Everything this shop stocks</div>
        </div>
        <div className="page-head-actions">
          {canCreate && (
            <button className="btn btn-primary" onClick={openCreate} disabled={noMasterData}>
              + New product
            </button>
          )}
        </div>
      </div>

      {readOnly && <ReadOnly what="Products" />}
      <ErrorNote message={optionsError} onRetry={loadOptions} />

      {noMasterData && !optionsError && (
        <div className="alert alert-info">
          <span>◷</span>
          <div style={{ flex: 1 }}>
            <strong>Set up your lists first.</strong> The product form is built from your brands,
            models, accessory types, qualities and technologies.
          </div>
          <Link to="/brands" className="btn btn-ghost btn-sm">Go to brands</Link>
        </div>
      )}

      <ErrorNote message={list.error} onRetry={list.reload} />

      <div className="card">
        <div className="card-head">
          <div className="toolbar" style={{ flex: 1 }}>
            <input
              className="search"
              placeholder="Search by name, serial number, brand or technology…"
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
            hint={list.search ? 'Try a shorter term.' : 'Add your first product to get started.'}
            action={canCreate && !noMasterData && (
              <button className="btn btn-primary btn-sm" onClick={openCreate}>+ New product</button>
            )}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Brand / model</th>
                    <th>Type / quality</th>
                    <th className="num">Purchase</th>
                    <th className="num">Sale</th>
                    <th className="num">Stock</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <div className="strong">{p.name}</div>
                        <div className="small muted">
                          {p.itemNumber && <span className="mono">SN {p.itemNumber} · </span>}
                          <span className="mono">{p.sku}</span>
                        </div>
                      </td>
                      <td className="muted">
                        {p.brand?.name || '—'}
                        {p.model?.name && <div className="small">{p.model.name}</div>}
                      </td>
                      <td className="muted">
                        {p.category?.name || '—'}
                        <div className="small">
                          {p.technologyName && (
                            <span className="badge badge-gray" style={{ marginRight: 4 }}>{p.technologyName}</span>
                          )}
                          {p.partCompanyName && (
                            <span className="badge badge-gray" style={{ marginRight: 4 }}>{p.partCompanyName}</span>
                          )}
                          {p.qualityName || ''}
                        </div>
                      </td>
                      {/* The shopkeeper types this number in; the API returns it
                          to them without a step-up. A Shop User without
                          cost.view gets it stripped and sees ••••. */}
                      <td className="num muted">{money(p.purchasePrice)}</td>
                      <td className="num strong">{money(p.salePrice)}</td>
                      <td className="num">
                        <span className={`badge ${p.quantity <= 0 ? 'badge-red' : 'badge-gray'}`}>
                          {number(p.quantity)} {p.unit}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${p.isActive ? 'badge-green' : 'badge-gray'}`}>
                          {p.isActive ? 'Active' : 'Disabled'}
                        </span>{' '}
                        <span
                          className={`badge ${p.isPublic ? 'badge-blue' : 'badge-gray'}`}
                          title={p.isPublic
                            ? 'Listed on the consumer marketplace — consumers see the sale price only'
                            : 'Not published — consumers cannot see this'}
                        >
                          {p.isPublic ? 'Published' : 'Private'}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>
                          {canUpdate ? 'Edit' : 'View'}
                        </button>
                        {canPublish && p.isActive && (
                          <>
                            {' '}
                            <button className="btn btn-ghost btn-sm" onClick={() => togglePublish(p)}>
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
                  ))}
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
            {(editing ? canUpdate : canCreate) && (
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <><span className="spinner" /> Saving…</> : editing ? 'Save changes' : 'Create product'}
              </button>
            )}
          </>
        }
      >
        <form onSubmit={save}>
          <ErrorNote message={formError} />

          <div className="form-row">
            <div className="field">
              <label>Product name *</label>
              <input value={form.name} onChange={set('name')}
                     placeholder="iPhone 17 Pro OLED Display" required autoFocus />
            </div>
            <div className="field">
              <label>Serial number <span className="muted">(optional)</span></label>
              <input value={form.itemNumber} onChange={set('itemNumber')} placeholder="Your own reference" />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Brand</label>
              <SearchableSelect
                value={form.brand}
                onChange={(v) => set('brand')({ target: { value: v } })}
                options={options.brands}
                placeholder="Select a brand…"
              />
            </div>
            <div className="field">
              <label>Brand model</label>
              <SearchableSelect
                value={form.model}
                onChange={(v) => set('model')({ target: { value: v } })}
                options={modelsForBrand}
                disabled={modelsForBrand.length === 0}
                placeholder={form.brand && modelsForBrand.length === 0
                  ? 'No models for this brand yet'
                  : 'Select a model…'}
                // With no brand chosen the list is every model in the shop, so
                // the make has to be visible and searchable beside the name.
                getMeta={form.brand ? null : (m) => m.brandName}
              />
              {form.brand && modelsForBrand.length === 0 && (
                <div className="hint">
                  <Link to="/brand-models">Add one on the Mobile brand models page →</Link>
                </div>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Accessories type</label>
              <SearchableSelect
                value={form.category}
                onChange={(v) => set('category')({ target: { value: v } })}
                options={options.accessoryTypes}
                placeholder="Select a type…"
              />
            </div>
            <div className="field">
              <label>Accessories quality type</label>
              <SearchableSelect
                value={form.quality}
                onChange={(v) => set('quality')({ target: { value: v } })}
                options={options.qualities}
                placeholder="Select a quality…"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Technology</label>
              <SearchableSelect
                value={form.technology}
                onChange={(v) => set('technology')({ target: { value: v } })}
                options={options.technologies}
                placeholder="Select a technology…"
              />
              <div className="hint">What the panel is — K-COMBO, INCELL, OLED2.</div>
            </div>
            <div className="field">
              <label>Part company</label>
              <SearchableSelect
                value={form.partCompany}
                onChange={(v) => set('partCompany')({ target: { value: v } })}
                options={options.partCompanies}
                placeholder="Select a company…"
              />
              <div className="hint">Who made or supplied it — BOE, Tianma, GX.</div>
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Stock</label>
              <input
                type="number" min="0" value={form.quantity} onChange={set('quantity')}
                disabled={Boolean(editing)}
              />
              <div className="hint">
                {editing
                  ? 'Stock changes through purchases, sales and inventory adjustments, so it is not editable here.'
                  : 'Opening stock. Recorded as an opening movement, so the count and the stock ledger agree.'}
              </div>
            </div>
            <div className="field">
              <label>Purchase price</label>
              <input
                type="number" min="0" step="0.01"
                value={form.purchasePrice} onChange={set('purchasePrice')}
              />
              <div className="hint">
                {editing
                  ? 'Once stock has been received this becomes the weighted average of what was paid, and changes through a purchase.'
                  : 'What you pay. Never shown to consumers.'}
              </div>
            </div>
            <div className="field">
              <label>Sale price *</label>
              <input
                type="number" min="0" step="0.01" required
                value={form.salePrice} onChange={set('salePrice')}
              />
              <div className="hint">The only price a consumer sees.</div>
            </div>
          </div>

          <div className="field">
            <label>Description <span className="muted">(optional)</span></label>
            <textarea rows={3} value={form.description} onChange={set('description')}
                      placeholder="Optional" />
          </div>

          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input type="checkbox" checked={form.isActive} onChange={set('isActive')}
                     style={{ width: 'auto', marginRight: 6 }} />
              Active — this shop still trades this part
            </label>
            {canPublish && (
              <label style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
                <input type="checkbox" checked={form.isPublic} onChange={set('isPublic')}
                       style={{ width: 'auto', marginRight: 6 }} />
                Published — consumers see it, and only its sale price
              </label>
            )}
          </div>

          <button type="submit" style={{ display: 'none' }} />
        </form>
      </Modal>
    </>
  );
}
