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
    { name: 'densityGPerMl', type: 'number', admin: { description: 'Optional — enables weight⇄volume for tsp/tbsp/ml/cup. Defaults to ~1 (water) when blank.' } },
    {
      name: 'gramsPerPiece',
      type: 'number',
      admin: { description: 'Average grams for one piece — 1 egg ≈ 50, 1 clove garlic ≈ 3, 1 onion ≈ 110. Enables count / “no unit” quantities in nutrition.' },
    },
    {
      name: 'nutrition',
      type: 'group',
      admin: { description: 'Per 100g (USDA). Powers recipe calorie/macro estimates — leave blank and the recipe just skips this ingredient.' },
      fields: [
        { name: 'kcalPer100g', type: 'number', min: 0 },
        { name: 'proteinPer100g', type: 'number', min: 0 },
        { name: 'carbsPer100g', type: 'number', min: 0 },
        { name: 'fatPer100g', type: 'number', min: 0 },
        { name: 'source', type: 'text', admin: { readOnly: true, description: 'USDA food matched at seed time.' } },
      ],
    },
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
