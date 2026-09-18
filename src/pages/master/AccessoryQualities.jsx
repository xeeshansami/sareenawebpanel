import MasterDataPage from '../../components/MasterDataPage.jsx';

/**
 * Accessories Quality Type — the grade a part is supplied at.
 *
 * Sorted by `sortOrder` rather than alphabetically, because alphabetical puts
 * "1st Copy" above "Original" and that is backwards for the person choosing.
 */
export default function AccessoryQualities() {
  return (
    <MasterDataPage
      title="Accessories quality type"
      singular="Quality"
      path="/accessory-qualities"
      icon="◈"
      intro="Grades — Original, OEM, 1st Copy, Refurbished. These fill the Quality dropdown on the product form."
      searchPlaceholder="Search qualities — original, copy, OEM…"
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
          name: 'name', label: 'Quality name', required: true, autoFocus: true,
          placeholder: 'e.g. 3rd Copy',
        },
        { name: 'description', label: 'Note', placeholder: 'Optional' },
        {
          name: 'sortOrder', label: 'Sort order', type: 'number',
          hint: 'Lower numbers come first in the dropdown. Original is 10, Copy is 90.',
        },
      ]}
    />
  );
}
