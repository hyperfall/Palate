import type { CollectionConfig } from 'payload'

import { slugField } from '../fields/slug'

/** The canonical ingredient namespace — the key substitutions, step-timing, and
 *  nutrition estimates build on. Freeform recipe items normalize into these on
 *  save; `needsReview` flags auto-created drafts for editor cleanup.
 *
 *  Fields are split into a Details tab and a Nutrition tab (unnamed tabs, so the
 *  stored shape is unchanged — this is purely admin organization). */
export const Ingredients: CollectionConfig = {
  slug: 'ingredients',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'category', 'needsReview'], group: 'Content' },
  access: { read: () => true },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Details',
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
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description:
                  'A photo of the ingredient, used in the cost calculator and shopping lists. Optional — without one, a tinted tile keyed to the category stands in, so a missing photo reads as a placeholder rather than a broken image.',
              },
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
          ],
        },
        {
          label: 'Nutrition',
          description:
            'Per-100g values plus the measures that convert a recipe’s quantities to grams. Powers recipe calorie/macro estimates — leave blank and the recipe just skips this ingredient.',
          fields: [
            {
              name: 'densityGPerMl',
              type: 'number',
              admin: { description: 'Optional — enables weight⇄volume for tsp/tbsp/ml/cup. Defaults to ~1 (water) when blank.' },
            },
            {
              name: 'gramsPerPiece',
              type: 'number',
              admin: { description: 'Average grams for one piece — 1 egg ≈ 50, 1 clove garlic ≈ 3, 1 onion ≈ 110. Enables count / “no unit” quantities.' },
            },
            {
              name: 'nutrition',
              type: 'group',
              label: 'Per 100g',
              fields: [
                { name: 'kcalPer100g', type: 'number', min: 0, label: 'Calories (kcal)' },
                { name: 'proteinPer100g', type: 'number', min: 0, label: 'Protein (g)' },
                { name: 'carbsPer100g', type: 'number', min: 0, label: 'Carbs (g)' },
                { name: 'fatPer100g', type: 'number', min: 0, label: 'Fat (g)' },
                { name: 'saturatesPer100g', type: 'number', min: 0, label: 'Saturates (g)' },
                { name: 'sugarsPer100g', type: 'number', min: 0, label: 'Sugars (g)' },
                { name: 'fibrePer100g', type: 'number', min: 0, label: 'Fibre (g)' },
                { name: 'saltPer100g', type: 'number', min: 0, label: 'Salt (g)' },
                { name: 'source', type: 'text', admin: { readOnly: true, description: 'USDA food matched at seed time.' } },
              ],
            },
          ],
        },
        {
          label: 'Price',
          description:
            'A typical shelf price, used to cost a recipe for anyone who has not recorded their own. Signed-in cooks override this with what they actually pay. Leave blank and the recipe reports this ingredient as unpriced rather than free.',
          fields: [
            {
              name: 'price',
              type: 'group',
              label: 'Typical price',
              fields: [
                {
                  name: 'packPrice',
                  type: 'number',
                  min: 0,
                  label: 'Pack price (pence)',
                  admin: {
                    description:
                      'In pence, GBP — the baseline is authored in one currency on purpose. A cook shopping elsewhere records their own prices; we never convert, because a made-up exchange rate is worse than saying we do not know.',
                  },
                },
                {
                  name: 'packAmount',
                  type: 'number',
                  min: 0,
                  label: 'Pack size',
                  admin: { description: 'How much is in that pack: 500, 750, 12.' },
                },
                {
                  name: 'packUnit',
                  type: 'select',
                  label: 'Pack unit',
                  options: [
                    { label: 'grams', value: 'g' },
                    { label: 'millilitres', value: 'ml' },
                    { label: 'pieces', value: 'piece' },
                  ],
                  admin: {
                    description:
                      'Pieces skips the weight conversion entirely — "12 eggs for £3" needs no grams-per-egg.',
                  },
                },
                {
                  name: 'source',
                  type: 'text',
                  label: 'Where this price came from',
                  admin: {
                    description:
                      'The shop and product it was read off, e.g. "Tesco Olive Oil 500ml". A price nobody can trace is a guess wearing a number — this is what makes it checkable.',
                  },
                },
                {
                  name: 'checkedAt',
                  type: 'date',
                  label: 'Last checked',
                  admin: {
                    description:
                      'Groceries move. This is how you find the prices that have gone stale rather than re-checking all of them.',
                    date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    { name: 'needsReview', type: 'checkbox', defaultValue: false, index: true, admin: { position: 'sidebar' } },
  ],
}
