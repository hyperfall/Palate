import type { CollectionConfig } from 'payload'

import { slugField } from '../fields/slug'

/** The canonical ingredient namespace — the key substitutions, step-timing, and
 *  future decision/planning features build on. Freeform recipe items normalize
 *  into these on save; `needsReview` flags auto-created drafts for editor cleanup. */
export const Ingredients: CollectionConfig = {
  slug: 'ingredients',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'category', 'needsReview'], group: 'Content' },
  access: { read: () => true },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'aliases', type: 'text', hasMany: true, admin: { description: 'Other names that map here.' } },
    {
      name: 'category',
      type: 'select',
      options: ['produce', 'dairy', 'protein', 'oil-fat', 'grain-legume', 'spice-herb', 'condiment', 'bakery', 'other'],
      defaultValue: 'other',
    },
    { name: 'countable', type: 'checkbox', defaultValue: false, admin: { description: 'Discrete items (eggs, cloves).' } },
    { name: 'densityGPerMl', type: 'number', admin: { description: 'Optional — enables weight⇄volume when known.' } },
    {
      name: 'substitutions',
      type: 'array',
      fields: [
        { name: 'sub', type: 'relationship', relationTo: 'ingredients' },
        { name: 'subText', type: 'text', admin: { description: 'Free-text sub when not a catalog ingredient.' } },
        { name: 'kind', type: 'select', required: true, options: ['flavor', 'texture', 'cupboard'] },
        { name: 'ratio', type: 'text', admin: { description: 'e.g. "1:1", "use ¾".' } },
        { name: 'note', type: 'text' },
      ],
    },
    { name: 'needsReview', type: 'checkbox', defaultValue: false, index: true, admin: { position: 'sidebar' } },
  ],
}
