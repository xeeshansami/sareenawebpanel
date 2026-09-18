import MasterDataPage from '../../components/MasterDataPage.jsx';

/**
 * Accessories Type — what the part IS. LCD, LED, Battery, Charging Port.
 *
 * The collection behind this is still called Category, and the field on a
 * product is still `category`. Renaming either would break the public
 * marketplace, the invoice importer and the `by/category` reports dimension for
 * the sake of a label, so only the label moved.
 */
export default function AccessoryTypes() {
  return (
    <MasterDataPage
      title="Accessories type"
      singular="Accessory type"
      path="/categories"
      icon="▦"
      intro="The kind of part — LCD, LED, Battery, Charging Port. These fill the Accessories Type dropdown on the product form."
      searchPlaceholder="Search types — LCD, battery, camera…"
      fields={[
        {
          name: 'name', label: 'Type name', required: true, autoFocus: true,
          placeholder: 'e.g. Vibrator Motor',
          hint: 'Some seeded names are matched by the invoice reader — renaming "Panels" will stop it filing panels automatically.',
        },
        { name: 'description', label: 'Note', placeholder: 'Optional' },
      ]}
    />
  );
}
