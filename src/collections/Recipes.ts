import type { CollectionConfig } from 'payload'

import { PROVENANCE } from '../lib/taxonomy'
import { deriveTotalMinutes, recipeBodyFields, recipeFacetFields } from '../fields/recipeContent'
import { slugField } from '../fields/slug'

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
          fields: recipeFacetFields(),
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
