import type { CollectionConfig } from 'payload'

import { PROVENANCE } from '../lib/taxonomy'
import { deriveTotalMinutes, recipeBodyFields, recipeFacetFields } from '../fields/recipeContent'
import { slugField } from '../fields/slug'
import { normalizeItem } from '../lib/ingredients/normalize'
import { matchIngredient, type Candidate } from '../lib/ingredients/match'

/** Design spec §5 `recipes`. */
export const Recipes: CollectionConfig = {
  slug: 'recipes',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'cuisine', 'provenance', 'status', 'publishedAt'],
    group: 'Content',
  },
  access: {
    // Drafts stay private; only published recipes are publicly readable.
    read: ({ req }) => {
      if (req.user) return true
      return { status: { equals: 'published' } }
    },
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        deriveTotalMinutes(data)
        if (data?.status === 'published' && !data?.publishedAt) {
          data.publishedAt = new Date().toISOString()
        }
        // Denormalise the sortable/filterable rating into one column. Editorial
        // rating (a curator override) wins; otherwise it's the community average,
        // or 0 when nothing has been rated yet. The rate endpoint bumps sum/count
        // and re-saves, which re-runs this — so the score is never stale.
        const count = typeof data.ratingCount === 'number' ? data.ratingCount : 0
        const sum = typeof data.ratingSum === 'number' ? data.ratingSum : 0
        const editorial =
          typeof data.editorialRating === 'number' ? data.editorialRating : null
        data.ratingScore =
          editorial ?? (count > 0 ? Math.round((sum / count) * 100) / 100 : 0)
        return data
      },
      async ({ data, req }) => {
        const rows = (data.ingredients ?? []) as Array<{
          item?: string
          ingredient?: unknown
          needsReview?: boolean
        }>
        if (!rows.some((r) => r.item && !r.ingredient)) return data

        const found = await req.payload.find({ collection: 'ingredients', limit: 1000, depth: 0, req })
        const candidates: Candidate[] = found.docs.map((d) => ({
          id: d.id as number,
          name: d.name as string,
          aliases: (d.aliases as string[] | undefined) ?? [],
        }))

        for (const row of rows) {
          if (row.ingredient || !row.item) continue
          const normalized = normalizeItem(row.item)
          if (!normalized) continue
          const match = matchIngredient(normalized, candidates)
          if (match) {
            row.ingredient = match.id
            continue
          }
          const created = await req.payload.create({
            collection: 'ingredients',
            req,
            data: { name: normalized, needsReview: true } as never,
          })
          candidates.push({ id: created.id as number, name: normalized, aliases: [] })
          row.ingredient = created.id
          row.needsReview = true
        }
        return data
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Recipe',
          fields: [
            ...recipeBodyFields(),
            {
              name: 'videoUrl',
              type: 'text',
              admin: {
                description:
                  'Optional. A creator’s TikTok/YouTube/Reels/Vimeo link — embedded on the recipe page. Set automatically when a creator submission is approved.',
              },
            },
          ],
        },
        {
          label: 'Taste & filters',
          description: 'These drive the faceted catalog — the differentiator (§7).',
          fields: [
            ...recipeFacetFields(),
            {
              name: 'editorialRating',
              type: 'number',
              min: 1,
              max: 5,
              admin: {
                description:
                  'Optional curator override (1–5). Leave blank to show the community average — we don’t seed ratings.',
              },
            },
            {
              name: 'ratingCount',
              type: 'number',
              defaultValue: 0,
              admin: { readOnly: true, description: 'Number of community votes. Maintained by the rate endpoint.' },
            },
            {
              name: 'ratingSum',
              type: 'number',
              defaultValue: 0,
              admin: { readOnly: true, description: 'Sum of community stars (average = sum ÷ count).' },
            },
            {
              name: 'ratingScore',
              type: 'number',
              defaultValue: 0,
              index: true,
              admin: {
                readOnly: true,
                description: 'Derived: editorial override, else community average, else 0. Drives sort & filter.',
              },
            },
          ],
        },
        {
          label: 'Provenance & partnerships',
          fields: [
            {
              name: 'provenance',
              type: 'select',
              required: true,
              defaultValue: 'authored',
              options: [...PROVENANCE],
              index: true,
              admin: {
                description:
                  'Load-bearing (§3): drives trust badges, filtering, and Google transparency.',
              },
            },
            {
              name: 'author',
              type: 'relationship',
              relationTo: 'authors',
              required: true,
            },
            {
              name: 'sourceAttribution',
              type: 'group',
              admin: {
                description:
                  'Required for api-imported recipes — imported content is duplicate content across the web and must carry canonical attribution (§3, §8).',
                condition: (data) => data?.provenance === 'api-imported',
              },
              fields: [
                { name: 'sourceName', type: 'text' },
                { name: 'sourceUrl', type: 'text' },
              ],
            },
            {
              name: 'brandSlots',
              type: 'relationship',
              relationTo: 'brandCards',
              hasMany: true,
              admin: {
                description:
                  'Optional direct assignment. Cards can also become eligible via their own cuisine/recipe targeting.',
              },
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            {
              name: 'metaTitle',
              type: 'text',
              admin: { description: 'Falls back to the recipe title.' },
            },
            {
              name: 'metaDescription',
              type: 'textarea',
              maxLength: 200,
              admin: { description: 'Falls back to the first line of the story.' },
            },
            {
              name: 'ogImage',
              type: 'upload',
              relationTo: 'media',
              admin: { description: 'Falls back to the hero image.' },
            },
          ],
        },
      ],
    },
    slugField('title'),
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: { position: 'sidebar', description: 'Set automatically on first publish.' },
    },
  ],
}
