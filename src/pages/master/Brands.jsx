import MasterDataPage from '../../components/MasterDataPage.jsx';

/**
 * Mobile Brand Names.
 *
 * A new shop is seeded with the makes the market actually trades in, and the
 * shopkeeper owns the list from there — the whole reason this is a page rather
 * than an array in the source.
 */
export default function Brands() {
  return (
    <MasterDataPage
      title="Mobile brand names"
      singular="Brand"
      path="/brands"
      icon="⌸"
      intro="The makes this shop stocks parts for. These fill the Brand dropdown on the product form."
      searchPlaceholder="Search brands — Samsung, Oppo, Infinix…"
      fields={[
        {
          name: 'name', label: 'Brand name', required: true, autoFocus: true,
          placeholder: 'e.g. Nothing',
          hint: 'Case is ignored when checking for duplicates — "apple" and "Apple" are the same brand.',
        },
        { name: 'description', label: 'Note', placeholder: 'Optional' },
      ]}
    />
  );
}
