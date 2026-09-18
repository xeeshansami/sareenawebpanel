import MasterDataPage from '../../components/MasterDataPage.jsx';

/**
 * Part Company — the house that made or distributes the part.
 *
 * Separate from Technology, and the split is the one the counter makes:
 * Technology is what the panel *is* (K-COMBO, INCELL, OLED2), a part company is
 * who *made* it (BOE, Tianma, GX). The same INCELL panel comes from several
 * houses at different prices, so a shopkeeper pricing stock needs both facts and
 * neither stands in for the other.
 */
export default function PartCompanies() {
  return (
    <MasterDataPage
      title="Part company"
      singular="Part company"
      path="/part-companies"
      icon="⬢"
      intro="The companies that make or distribute the panels you stock — BOE, Tianma, GX, ZY. These fill the Part company dropdown on the product form."
      searchPlaceholder="Search companies — BOE, Tianma, GX…"
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
          name: 'name', label: 'Company name', required: true, autoFocus: true,
          placeholder: 'e.g. Tianma',
          hint: 'Keeps the capitalisation you type. Case is ignored when checking for duplicates.',
        },
        { name: 'description', label: 'Note', placeholder: 'Optional' },
        {
          name: 'sortOrder', label: 'Sort order', type: 'number',
          hint: 'Lower numbers come first. The trade shorthand is 10–70, the manufacturers 100 up.',
        },
      ]}
    />
  );
}
