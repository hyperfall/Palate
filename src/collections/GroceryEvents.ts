import type { CollectionConfig } from 'payload'

/**
 * Grocery handoff telemetry: one row per retailer impression (panel render) or
 * click (redirect out). Written server-side only — the mirror of adEvents for
 * the "Shop this list" engine. Per-retailer CTR in the retailer admin view is
 * computed from these rows.
 *
 * Pre-launch volume is trivial; keep rows unaggregated, roll up later if needed.
 */
export const GroceryEvents: CollectionConfig = {
  slug: 'groceryEvents',
  labels: { singular: 'Grocery event', plural: 'Grocery events' },
  admin: {
    useAsTitle: 'kind',
    defaultColumns: ['kind', 'retailer', 'country', 'createdAt'],
    group: 'Partnerships',
    description: 'Impression/click log behind Shop this list. Written automatically.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Impression', value: 'impression' },
        { label: 'Click', value: 'click' },
      ],
    },
    { name: 'retailer', type: 'relationship', relationTo: 'groceryRetailers', required: true, index: true },
    { name: 'country', type: 'text', maxLength: 2 },
  ],
}
