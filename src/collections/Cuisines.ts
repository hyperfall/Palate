import type { CollectionConfig } from 'payload'

import { slugField } from '../fields/slug'

/** Design spec §5 `cuisines`. Also the backing content for the /cuisine/[slug] SEO hubs (§7). */
export const Cuisines: CollectionConfig = {
  slug: 'cuisines',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'region', 'updatedAt'],
    group: 'Content',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    slugField('name'),
    {
      name: 'region',
      type: 'select',
      required: true,
      options: [
        { label: 'East Asia', value: 'east-asia' },
        { label: 'South Asia', value: 'south-asia' },
        { label: 'Southeast Asia', value: 'southeast-asia' },
        { label: 'Middle East', value: 'middle-east' },
        { label: 'Africa', value: 'africa' },
        { label: 'Northern Europe', value: 'northern-europe' },
        { label: 'Southern Europe', value: 'southern-europe' },
        { label: 'Eastern Europe', value: 'eastern-europe' },
        { label: 'North America', value: 'north-america' },
        { label: 'Latin America', value: 'latin-america' },
        { label: 'Caribbean', value: 'caribbean' },
        { label: 'Oceania', value: 'oceania' },
        // Umbrella cuisines (Mediterranean, Asian, Jewish…) span borders.
        { label: 'Cross-regional', value: 'cross-regional' },
      ],
    },
    {
      name: 'flagEmoji',
      type: 'text',
      admin: {
        description: 'Optional. Used as a lightweight glyph where a hero image would be too heavy.',
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'One or two sentences. Doubles as the cuisine hub meta description.',
      },
    },
  ],
}
