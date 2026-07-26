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
      ({ data, originalDoc }) => {
        deriveTotalMinutes(data)
        if (data?.status === 'published' && !data?.publishedAt) {
          data.publishedAt = new Date().toISOString()
        }
        // Denormalise the sortable/filterable rating into one column. Editorial
        // rating (a curator override) wins; otherwise it's the community average,
        // or 0 when nothing has been rated yet.
        //
        // Hooks receive the RAW partial update, not the merged doc — a
        // `{ nutrition }`-only update would otherwise read count/sum/editorial as
        // absent and stomp the score to 0 (or silently drop the curator
        // override). Fall back to the stored doc for any field the update didn't
        // touch. `editorialRating: null` is a deliberate clear and must NOT fall
        // back — undefined means untouched, null means cleared.
        const orig = (originalDoc ?? {}) as Record<string, unknown>
        const pickNum = (k: string): number =>
          typeof data[k] === 'number' ? (data[k] as number) : typeof orig[k] === 'number' ? (orig[k] as number) : 0
        const count = pickNum('ratingCount')
        const sum = pickNum('ratingSum')
        const editorial =
          data.editorialRating !== undefined
            ? typeof data.editorialRating === 'number'
              ? data.editorialRating
              : null
            : typeof orig.editorialRating === 'number'
              ? (orig.editorialRating as number)
              : null
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
            {
              name: 'heroAnnotator',
              type: 'ui',
              admin: {
                components: { Field: '@/components/admin/HeroAnnotator#HeroAnnotator' },
              },
            },
            {
              name: 'heroAnnotations',
              type: 'array',
              label: 'Hero annotations',
              labels: { singular: 'Pin', plural: 'Pins' },
              admin: {
                description:
                  'Mise-en-place pins on the hero photo — a short kicker + note, hidden on the page until a reader hovers or taps. Place them visually on the photo above; add, remove, and label them here.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'x',
                      type: 'number',
                      required: true,
                      min: 0,
                      max: 100,
                      admin: { width: '20%', description: '% from left' },
                    },
                    {
                      name: 'y',
                      type: 'number',
                      required: true,
                      min: 0,
                      max: 100,
                      admin: { width: '20%', description: '% from top' },
                    },
                    {
                      name: 'kicker',
                      type: 'text',
                      required: true,
                      maxLength: 24,
                      admin: { width: '60%', description: 'Short label, e.g. “Yolk”.' },
                    },
                  ],
                },
                {
                  name: 'note',
                  type: 'text',
                  required: true,
                  maxLength: 80,
                  admin: { description: 'One line, e.g. “Pull at 6 min — jammy, not set.”' },
                },
              ],
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
