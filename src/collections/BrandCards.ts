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
            {
              name: 'cardPreview',
              type: 'ui',
              admin: { components: { Field: '@/components/admin/BrandCardPreview#BrandCardPreview' } },
            },
            { name: 'brand', type: 'text', required: true },
            {
              name: 'logo',
              type: 'upload',
              relationTo: 'media',
              admin: { description: 'The brand mark. One per brand — used when a creative has no image of its own.' },
            },
            {
              name: 'creatives',
              type: 'array',
              labels: { singular: 'Creative', plural: 'Creatives' },
              maxRows: 8,
              admin: {
                description:
                  'One or more images for this campaign. Several are rotated evenly per visitor, so a brand can run a set rather than a single picture, and a tired creative can be retired without pausing the card. Leave empty to fall back to the brand logo.',
                initCollapsed: true,
              },
              fields: [
                { name: 'image', type: 'upload', relationTo: 'media', required: true },
                {
                  name: 'tagline',
                  type: 'textarea',
                  maxLength: 160,
                  admin: {
                    description:
                      'Optional line for THIS image. Leave empty to use the campaign tagline below.',
                  },
                },
                {
                  name: 'active',
                  type: 'checkbox',
                  defaultValue: true,
                  admin: { description: 'Retire one image without touching the rest of the campaign.' },
                },
              ],
            },
            {
              name: 'productImage',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description:
                  'Legacy single image. Cards created before creatives existed still render from this; prefer Creatives above.',
                condition: (data) => Boolean(data?.productImage) && !(data?.creatives ?? []).length,
              },
            },
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
              // The click route already refuses anything but http(s) at redirect
              // time. Catching it here means a bad paste fails in front of the
              // person who can fix it, rather than silently dead-ending readers.
              validate: (value: unknown) => {
                if (typeof value !== 'string' || !value.trim()) return 'A destination is required.'
                let url: URL
                try {
                  url = new URL(value.trim())
                } catch {
                  return 'Enter a full URL, including https://'
                }
                if (url.protocol !== 'https:' && url.protocol !== 'http:') {
                  return 'Only http and https destinations are allowed.'
                }
                if (url.protocol === 'http:') return 'Use https:// — readers are sent here from a secure page.'
                return true
              },
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
          label: 'Commercials',
          fields: [
            {
              name: 'revSharePercent',
              type: 'number',
              defaultValue: 50,
              min: 0,
              max: 100,
              admin: {
                description:
                  'Percent of this card’s revenue shared with the recipe’s creator. Baseline 50 (platform keeps 50).',
              },
            },
            {
              name: 'cpmCents',
              type: 'number',
              defaultValue: 0,
              min: 0,
              admin: {
                description:
                  'Revenue in cents per 1,000 impressions (CPM). Drives estimated creator earnings. 0 until a real rate is agreed with the partner.',
              },
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
            {
              name: 'maxImpressions',
              type: 'number',
              min: 0,
              admin: {
                description:
                  'Stop serving after this many impressions. Empty means no cap. A flight that can only be ended by a date or by remembering to switch it off is not a campaign you control — this is how a fixed buy stops itself.',
              },
            },
            {
              name: 'impressionsServed',
              type: 'number',
              defaultValue: 0,
              admin: {
                readOnly: true,
                description: 'Counted from the impression log. Read-only.',
              },
            },
            {
              name: 'cardStats',
              type: 'ui',
              admin: { components: { Field: '@/components/admin/BrandCardStats#BrandCardStats' } },
            },
          ],
        },
      ],
    },
  ],
}
