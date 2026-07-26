import type { CollectionConfig } from 'payload'

import { syncRecipeRating } from '../lib/ratingSync'

/**
 * One community rating: a single user's 1–5 stars for one recipe. Rows are
 * written only through the authenticated `/recipe/rate` endpoint, which also
 * maintains the recipe's denormalised aggregate (`ratingSum` / `ratingCount`)
 * so cards, filters, sort, and JSON-LD read one indexed number off the recipe
 * instead of aggregating this collection per request.
 *
 * The compound unique index is the real one-vote-per-user guarantee — the
 * endpoint upserts, but the database is what makes a double-vote impossible.
 */
export const Ratings: CollectionConfig = {
  slug: 'ratings',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['recipe', 'stars', 'userId', 'createdAt'],
    group: 'Community',
    description:
      'Community star ratings — one per user per recipe. Written by the rate endpoint; the recipe’s average is kept in sync there.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    // An admin deleting a row from /admin would otherwise leave the recipe's
    // denormalised sum/count drifted from the rows forever — resync from source.
    afterDelete: [
      async ({ doc, req }) => {
        const recipeId = typeof doc.recipe === 'object' && doc.recipe ? doc.recipe.id : doc.recipe
        if (typeof recipeId === 'number') {
          await syncRecipeRating(req.payload, recipeId).catch(() => {})
        }
      },
    ],
  },
  // DB-level one-vote-per-user — the endpoint upserts, this makes a race a no-op.
  indexes: [{ fields: ['recipe', 'userId'], unique: true }],
  fields: [
    { name: 'recipe', type: 'relationship', relationTo: 'recipes', required: true, index: true },
    {
      name: 'userId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Supabase user id of the rater.' },
    },
    { name: 'stars', type: 'number', required: true, min: 1, max: 5 },
  ],
}
