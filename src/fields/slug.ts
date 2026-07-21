import type { Field } from 'payload'

/** Combining diacritical marks, left over after NFKD normalisation. */
const COMBINING_MARKS = /[̀-ͯ]/g

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '') // "Bún bò" -> "bun-bo"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Unique URL slug, auto-derived from `sourceField` when left blank.
 * Editors can still override it — once a recipe is published its URL is a
 * permanent SEO asset, so we never silently re-slug on title edits.
 */
export function slugField(sourceField = 'title'): Field {
  return {
    name: 'slug',
    type: 'text',
    required: true,
    unique: true,
    index: true,
    admin: {
      position: 'sidebar',
      description: 'Leave blank to generate from the title. Changing this changes the public URL.',
    },
    hooks: {
      beforeValidate: [
        ({ value, data }) => {
          if (typeof value === 'string' && value.trim().length > 0) return slugify(value)
          const source = data?.[sourceField]
          if (typeof source === 'string' && source.trim().length > 0) return slugify(source)
          return value
        },
      ],
    },
  }
}
