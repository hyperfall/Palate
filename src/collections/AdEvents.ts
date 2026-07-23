import type { CollectionConfig } from 'payload'

/**
 * Raw partner-card telemetry: one row per impression or click, tying a brand
 * card to the recipe it appeared on. This is the "Phase 2" tracking the
 * targeting engine deliberately deferred — it's what turns the stated creator
 * revenue share into an actual, if still estimated, ledger.
 *
 * Written server-side only (the brand-slot render logs impressions; the click
 * redirect logs clicks), so public create stays off. Read is admin-only;
 * creators see their own aggregated numbers through /studio/earnings, never
 * these raw rows.
 *
 * Pre-launch volume is trivial, so rows are kept unaggregated for honesty and
 * simplicity; roll up to daily buckets if it ever grows.
 */
export const AdEvents: CollectionConfig = {
  slug: 'adEvents',
  labels: { singular: 'Ad event', plural: 'Ad events' },
  admin: {
    useAsTitle: 'kind',
    defaultColumns: ['kind', 'brandCard', 'recipe', 'createdAt'],
    group: 'Partnerships',
    description: 'Impression/click log behind creator earnings. Written automatically.',
    hidden: false,
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
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
    { name: 'brandCard', type: 'relationship', relationTo: 'brandCards', required: true, index: true },
    { name: 'recipe', type: 'relationship', relationTo: 'recipes', required: true, index: true },
  ],
}
