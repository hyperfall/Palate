import type { CollectionConfig } from 'payload'

/**
 * Geo-aware grocery retailer registry — the second revenue engine, built on
 * the brandCards pattern: admin-managed eligibility (country match + priority),
 * server-side selection, event-tracked clicks. Each retailer turns the /plan
 * shopping list into search handoff links; when an affiliate template is set
 * the link is wrapped so approved programs earn from day one.
 *
 * Impressions/clicks/CTR are virtual, computed from groceryEvents only for
 * admin (REST) reads — the hot selection path uses the local API and skips the
 * counts entirely.
 */
export const GroceryRetailers: CollectionConfig = {
  slug: 'groceryRetailers',
  labels: { singular: 'Grocery retailer', plural: 'Grocery retailers' },
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'active', 'priority', 'network', 'impressions', 'clicks', 'ctr'],
    group: 'Partnerships',
    description:
      'Where "Shop this list" sends people, by country. Add affiliate templates as programs get approved — links work without them.',
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterRead: [
      async ({ doc, req }) => {
        // Stats for the admin UI only; local-API reads (selection, click route)
        // must stay cheap.
        if (req.payloadAPI !== 'REST') return doc
        try {
          const [imp, clk] = await Promise.all([
            req.payload.count({
              collection: 'groceryEvents',
              where: { and: [{ retailer: { equals: doc.id } }, { kind: { equals: 'impression' } }] },
            }),
            req.payload.count({
              collection: 'groceryEvents',
              where: { and: [{ retailer: { equals: doc.id } }, { kind: { equals: 'click' } }] },
            }),
          ])
          doc.impressions = imp.totalDocs
          doc.clicks = clk.totalDocs
          doc.ctr = imp.totalDocs > 0 ? Math.round((clk.totalDocs / imp.totalDocs) * 1000) / 10 : 0
        } catch {
          /* stats are cosmetic — never break a read */
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'label', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Stable id for links and seeds, e.g. "tesco".' },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'supermarket',
      options: [
        { label: 'Supermarket', value: 'supermarket' },
        { label: 'Delivery', value: 'delivery' },
        { label: 'Marketplace', value: 'marketplace' },
      ],
    },
    {
      name: 'countries',
      type: 'array',
      labels: { singular: 'Country', plural: 'Countries' },
      admin: { description: 'ISO codes (GB, US, DE…). Leave empty to show everywhere.' },
      fields: [
        {
          name: 'code',
          type: 'text',
          required: true,
          maxLength: 2,
          hooks: {
            beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value)],
          },
        },
      ],
    },
    {
      name: 'searchUrlTemplate',
      type: 'text',
      required: true,
      validate: (value: string | null | undefined) =>
        typeof value === 'string' && value.includes('{query}') ? true : 'Must contain {query}',
      admin: { description: 'Search URL with {query}, e.g. https://www.tesco.com/groceries/en-GB/search?query={query}' },
    },
    {
      name: 'affiliateUrlTemplate',
      type: 'text',
      validate: (value: string | null | undefined) =>
        value == null || value === '' || value.includes('{url}') ? true : 'Must contain {url} (the encoded search URL)',
      admin: {
        description:
          'Optional wrapper with {url}, e.g. https://www.awin1.com/cread.php?awinmid=…&ued={url}. Leave empty until the program is approved.',
      },
    },
    {
      name: 'network',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Awin', value: 'awin' },
        { label: 'Amazon Associates', value: 'amazon' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'priority',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: { position: 'sidebar', description: 'Higher shows first.' },
    },
    { name: 'active', type: 'checkbox', defaultValue: true, index: true, admin: { position: 'sidebar' } },
    { name: 'notes', type: 'textarea', admin: { position: 'sidebar' } },
    // Virtual stats (populated for admin reads by the afterRead hook).
    { name: 'impressions', type: 'number', virtual: true, admin: { readOnly: true, position: 'sidebar' } },
    { name: 'clicks', type: 'number', virtual: true, admin: { readOnly: true, position: 'sidebar' } },
    { name: 'ctr', type: 'number', virtual: true, admin: { readOnly: true, position: 'sidebar', description: 'Click-through %, all time.' } },
  ],
}
