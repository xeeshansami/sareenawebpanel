import MasterDataPage from '../../components/MasterDataPage.jsx';

/**
 * Technology — the panel technology or manufacturer behind a part.
 *
 * This is the page that replaces "Parts Company" in the shopkeeper's menu. It
 * holds both kinds of value the trade uses interchangeably: construction
 * (K-COMBO, INCELL, OLED2) and the panel house that made it (BOE, Tianma, GX).
 *
 * Names are stored in capitals because the invoice reader decodes against them
 * and product search matches the uppercase form.
 */
export default function Technologies() {
  return (
    <MasterDataPage
      title="Technology"
      singular="Technology"
      path="/technologies"
      icon="◉"
      intro="Panel technology and the companies that make them — K-COMBO, INCELL, OLED2, BOE, Tianma. These fill the Technology dropdown on the product form."
      searchPlaceholder="Search technology — combo, incell, OLED, BOE…"
      blankExtra={{ sortOrder: 500 }}
      toForm={(row) => ({ sortOrder: row.sortOrder ?? 500 })}
      toPayload={(form) => ({
        name: form.name,
        description: form.description || '',
        sortOrder: Number(form.sortOrder) || 500,
      })}
      columns={[{ key: 'sortOrder', label: 'Order', numeric: true }]}
      fields={[
        {
          name: 'name', label: 'Technology or company', required: true, autoFocus: true,
          placeholder: 'e.g. ZY',
          hint: 'Saved in capitals. The invoice reader matches the seeded names, so renaming "K-COMBO" stops it recognising combo panels.',
        },
        { name: 'description', label: 'Note', placeholder: 'Optional — e.g. panel house' },
        {
          name: 'sortOrder', label: 'Sort order', type: 'number',
          hint: 'Lower numbers come first in the dropdown.',
        },
      ]}
    />
  );
}
