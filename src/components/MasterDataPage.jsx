import { useState } from 'react';
import api, { errorMessage, CAPS } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import usePagedList from '../hooks/usePagedList.js';
import Modal from './Modal.jsx';
import Pagination from './Pagination.jsx';
import { Loading, Empty, ErrorNote } from './States.jsx';
import { number, dateTime } from '../utils/format.js';
import SearchableSelect from './SearchableSelect.jsx';

/**
 * One page, five uses.
 *
 * Mobile Brand Names, Mobile Brand Models, Accessories Type, Accessories
 * Quality Type and Technology are the same page with different nouns: search a
 * shop-scoped list, add what is missing, rename, retire. Writing that five
 * times is how the old panel ended up with a Models page that had search and a
 * Brands list that had neither.
 *
 * Everything here is server-driven. The list is paginated and searched by the
 * API, and nothing about the vocabulary is hardcoded in this file — the point
 * of the change is that a shopkeeper can add a brand without a deploy, and a
 * client holding its own copy of the list would defeat that.
 *
 * `fields` lets a page add its own inputs (the models page needs a brand
 * selector) without this component knowing what a model is.
 */
/**
 * "quality" → "qualities", "part company" → "part companies".
 *
 * Naive `+ 's'` produced "qualitys" and "part companys" on screen. This handles
 * the one rule that actually comes up here — a consonant before a final y —
 * and a page whose plural is genuinely irregular passes it explicitly.
 */
function pluralise(word) {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

export default function MasterDataPage({
  title,
  singular,
  plural,
  path,
  icon = '◆',
  intro,
  columns = [],
  fields = [],
  blankExtra = {},
  toForm = () => ({}),
  toPayload = (form) => form,
  searchPlaceholder,
  listParams = {},
  onSaved,
}) {
  const { can } = useAuth();
  const canCreate = can(CAPS.PRODUCT_CREATE);
  const canUpdate = can(CAPS.PRODUCT_UPDATE);
  const canDelete = can(CAPS.PRODUCT_DELETE);
  const readOnly = !canCreate && !canUpdate && !canDelete;

  const list = usePagedList(path, { limit: 25, params: listParams });

  const blank = { name: '', description: '', ...blankExtra };
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const openCreate = () => {
    setEditing(null);
    setForm(blank);
    setFormError('');
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({ name: row.name || '', description: row.description || '', ...toForm(row) });
    setFormError('');
    setOpen(true);
  };

  const set = (key) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: v }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = toPayload(form);
      if (editing) await api.put(`${path}/${editing._id}`, payload);
      else await api.post(path, payload);
      setOpen(false);
      list.reload();
      onSaved?.();
    } catch (err) {
      // The backend's message is written to be shown to a person — "Apple
      // already exists in this shop" beats anything this file could invent.
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Deleting may retire instead, and the shopkeeper needs to be told which
   * happened. The API says so in `message`; this shows it rather than assuming.
   */
  const remove = async (row) => {
    if (!window.confirm(`Delete "${row.name}"?\n\nIf any product uses it, it will be retired instead of deleted.`)) return;
    try {
      const { data } = await api.delete(`${path}/${row._id}`);
      if (data.message && !/^.+ deleted$/.test(data.message)) window.alert(data.message);
      list.reload();
      onSaved?.();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  };

  const reactivate = async (row) => {
    try {
      await api.put(`${path}/${row._id}`, { isActive: true });
      list.reload();
      onSaved?.();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  };

  return (
    <>
      <div className="card mb-3">
        <div className="card-head">
          <div style={{ minWidth: 0 }}>
            <h2>{title}</h2>
            {intro && <div className="small muted mt-1">{intro}</div>}
          </div>
          <div className="actions">
            {canCreate && (
              <button className="btn btn-primary btn-sm" onClick={openCreate}>
                + Add {singular.toLowerCase()}
              </button>
            )}
          </div>
        </div>

        <div className="card-body" style={{ paddingBottom: 0 }}>
          <input
            className="search"
            style={{ maxWidth: 380 }}
            placeholder={searchPlaceholder || `Search ${title.toLowerCase()}…`}
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
          />
          {list.pagination && (
            <div className="small muted mt-2">
              {number(list.pagination.total)}{' '}
              {list.pagination.total === 1
                ? singular.toLowerCase()
                : (plural || pluralise(singular)).toLowerCase()}
              {list.search ? ` matching "${list.search}"` : ' in this shop'}
            </div>
          )}
        </div>

        <ErrorNote message={list.error} onRetry={list.reload} />

        {list.loading ? (
          <Loading label={`Loading ${title.toLowerCase()}…`} />
        ) : list.items.length === 0 ? (
          <Empty
            icon={icon}
            title={list.search ? `Nothing matches "${list.search}"` : `No ${title.toLowerCase()} yet`}
            hint={
              list.search
                ? 'Try a shorter search, or add it as a new entry.'
                : `Add the first ${singular.toLowerCase()} to start using it on the product form.`
            }
            action={canCreate && (
              <button className="btn btn-primary btn-sm" onClick={openCreate}>
                + Add {singular.toLowerCase()}
              </button>
            )}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    {columns.map((c) => (
                      <th key={c.key} className={c.numeric ? 'num' : ''}>{c.label}</th>
                    ))}
                    <th>Added</th>
                    {!readOnly && <th style={{ width: 140 }} />}
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((row) => (
                    <tr key={row._id} style={row.isActive === false ? { opacity: 0.55 } : undefined}>
                      <td className="strong">
                        {row.name}
                        {row.isActive === false && (
                          <span className="badge badge-gray" style={{ marginLeft: 8 }}>retired</span>
                        )}
                        {row.description && <div className="small muted">{row.description}</div>}
                      </td>
                      {columns.map((c) => (
                        <td key={c.key} className={c.numeric ? 'num' : ''}>
                          {c.render ? c.render(row) : (row[c.key] ?? '—')}
                        </td>
                      ))}
                      <td className="muted small nowrap">{dateTime(row.createdAt)}</td>
                      {!readOnly && (
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {row.isActive === false && canUpdate && (
                              <button className="btn btn-ghost btn-sm" onClick={() => reactivate(row)}>
                                Restore
                              </button>
                            )}
                            {canUpdate && (
                              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(row)}>
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--danger)' }}
                                onClick={() => remove(row)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      )}
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
        title={editing ? `Edit ${singular.toLowerCase()}` : `Add ${singular.toLowerCase()}`}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : `Add ${singular.toLowerCase()}`}
            </button>
          </>
        }
      >
        <form onSubmit={save}>
          <ErrorNote message={formError} />

          {fields.map((field) => (
            <div className="field" key={field.name}>
              <label>
                {field.label}
                {field.required && <span style={{ color: 'var(--danger)' }}> *</span>}
              </label>
              {field.render
                ? field.render({ form, setForm, set })
                : field.type === 'select' ? (
                  <select value={form[field.name] ?? ''} onChange={set(field.name)} required={field.required}>
                    <option value="">{field.placeholder || 'Select…'}</option>
                    {(field.options || []).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type || 'text'}
                    value={form[field.name] ?? ''}
                    onChange={set(field.name)}
                    placeholder={field.placeholder}
                    required={field.required}
                    autoFocus={field.autoFocus}
                  />
                )}
              {field.hint && <div className="small muted mt-1">{field.hint}</div>}
            </div>
          ))}

          {/* Submit on Enter without a visible second button. */}
          <button type="submit" style={{ display: 'none' }} />
        </form>
      </Modal>
    </>
  );
}
