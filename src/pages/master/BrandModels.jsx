import { useEffect, useState } from 'react';
import api from '../../api/client.js';
import MasterDataPage from '../../components/MasterDataPage.jsx';

/**
 * Mobile Brand Models — the handsets parts are made for.
 *
 * The one master list that is not flat: a model belongs to a brand, and the
 * product form filters the model dropdown by the brand chosen above it. So the
 * brand selector here is required, and the API refuses a model whose brand is
 * not in this shop.
 *
 * Aliases are the other spellings the same handset is written as. They look
 * like a nicety and are not: the counter searches "NOTE 11" for a part the
 * invoice called "MI NOTE 11", and every alias listed here becomes searchable
 * on the products that reference the model.
 */
export default function BrandModels() {
  const [brands, setBrands] = useState([]);

  // `all=true` returns the active rows unpaged — the selector needs the whole
  // list, and a shop has tens of brands, not thousands.
  const loadBrands = () => {
    api.get('/brands', { params: { all: true } })
      .then(({ data }) => setBrands(data.data || []))
      .catch(() => setBrands([]));
  };

  useEffect(loadBrands, []);

  return (
    <MasterDataPage
      title="Mobile brand models"
      singular="Model"
      path="/models"
      icon="▤"
      intro="Handsets, grouped under their make. Search covers the model name, its aliases and the brand."
      searchPlaceholder="Search models — iPhone 17 Pro, Galaxy S25, X650…"
      blankExtra={{ brandId: '', aliases: '', series: '' }}
      toForm={(row) => ({
        brandId: row.brand?._id || row.brand || '',
        aliases: (row.aliases || []).join(', '),
        series: row.series || '',
      })}
      toPayload={(form) => ({
        brandId: form.brandId,
        name: form.name,
        aliases: String(form.aliases || '').split(',').map((a) => a.trim()).filter(Boolean),
        series: form.series || '',
      })}
      columns={[
        { key: 'brandName', label: 'Brand', render: (row) => row.brandName || row.brand?.name || '—' },
        {
          key: 'aliases',
          label: 'Also written as',
          render: (row) => (row.aliases?.length
            ? <span className="small muted">{row.aliases.join(', ')}</span>
            : <span className="muted">—</span>),
        },
      ]}
      fields={[
        {
          name: 'brandId', label: 'Brand', type: 'select', required: true,
          placeholder: 'Choose the make…',
          options: brands.map((b) => ({ value: b._id, label: b.name })),
          hint: brands.length === 0
            ? 'No brands yet — add one on the Mobile brand names page first.'
            : 'The product form shows only the models of the brand selected on it.',
        },
        {
          name: 'name', label: 'Model name', required: true,
          placeholder: 'e.g. IPHONE 17 PRO',
          hint: 'Stored in capitals, which is how invoices write it.',
        },
        {
          name: 'aliases', label: 'Aliases', placeholder: 'IP17 PRO, 17 PRO',
          hint: 'Comma separated. Every spelling here becomes searchable on products using this model.',
        },
        { name: 'series', label: 'Series', placeholder: 'Optional — e.g. Note series' },
      ]}
      onSaved={loadBrands}
    />
  );
}
