import type { CollectionConfig } from 'payload'

/**
 * Design spec §5 `brandCards` — Phase 1 is hand-curated in /admin, but every
 * ★ field the Phase-2 targeting engine needs exists here from commit one
 * (§2: design the ad *slot* now, defer the ad *engine*).
 *
 * Nothing here is a tracking pixel. Phase 1 stores eligibility data only;
 * impression/click logging is explicitly Phase 2 (§9).
 */
export const BrandCards: CollectionConfig = {
  slug: 'brandCards',
  labels: {
    singular: 'Brand card',
    plural: 'Brand cards',
  },
  admin: {
    useAsTitle: 'brand',
    defaultColumns: ['brand', 'active', 'weight', 'startsAt', 'endsAt'],
    group: 'Partnerships',
    description:
      'Hand-curated partner placements. Swapping a card in or out is a CMS edit — rotation stays fair automatically.',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Creative',
          fields: [
            { name: 'brand', type: 'text', required: true },
            { name: 'logo', type: 'upload', relationTo: 'media' },
            { name: 'productImage', type: 'upload', relationTo: 'media' },
            {
              name: 'tagline',
              type: 'textarea',
              required: true,
              maxLength: 160,
              admin: { description: 'One line. This is a card, not a banner.' },
            },
            { name: 'ctaLabel', type: 'text', required: true, defaultValue: 'Shop now' },
            {
              name: 'ctaUrl',
              type: 'text',
              required: true,
              admin: { description: 'Affiliate or partner destination. Rendered with rel="sponsored nofollow".' },
            },
          ],
        },
        {
          label: 'Targeting',
          description: 'Phase 1: hand-entered. Phase 2: backed by the targeting service, same shape.',
          fields: [
            {
              name: 'targetRegions',
              type: 'array',
              labels: { singular: 'Region', plural: 'Regions' },
              admin: {
                description:
                  'ISO country codes (GB, US, DE…). Leave empty to target globally.',
              },
              fields: [
                {
                  name: 'code',
                  type: 'text',
                  required: true,
                  maxLength: 2,
                  hooks: {
                    beforeValidate: [
                      ({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
                    ],
                  },
                },
              ],
            },
            {
              name: 'assignedCuisines',
              type: 'relationship',
              relationTo: 'cuisines',
              hasMany: true,
              admin: { description: 'Card is eligible on any recipe in these cuisines.' },
            },
            {
              name: 'assignedRecipes',
              type: 'relationship',
              relationTo: 'recipes',
              hasMany: true,
              admin: { description: 'Card is eligible on these specific recipes.' },
            },
          ],
        },
        {
          label: 'Flight',
          fields: [
            {
              name: 'weight',
              type: 'number',
              required: true,
              defaultValue: 1,
              min: 0,
              admin: {
                description:
                  'Relative share of impressions in the rotation. 2 is shown twice as often as 1. 0 disables without deactivating.',
              },
            },
            { name: 'active', type: 'checkbox', defaultValue: true, index: true },
            {
              name: 'startsAt',
              type: 'date',
              admin: { description: 'Optional. Card is ineligible before this moment.' },
            },
            {
              name: 'endsAt',
              type: 'date',
              admin: { description: 'Optional. Card is ineligible after this moment.' },
            },
          ],
        },
      ],
    },
  ],
}
