import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'

import { beforeAll, describe, expect, it } from 'vitest'

import { STORY_WORD_CAP } from '@/fields/recipeContent'

let payload: Payload

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

function story(text: string) {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr' as const,
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          direction: 'ltr' as const,
          children: [
            { type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 },
          ],
        },
      ],
    },
  }
}

/** Collect every field name in a collection, descending through tabs/rows/arrays. */
function fieldNames(payloadInstance: Payload, slug: string): Set<string> {
  const collection = payloadInstance.config.collections.find((c) => c.slug === slug)!
  const names = new Set<string>()

  const walk = (fields: Array<Record<string, unknown>>) => {
    for (const field of fields) {
      if (typeof field.name === 'string') names.add(field.name)
      if (Array.isArray(field.fields)) walk(field.fields as never)
      if (Array.isArray(field.tabs)) {
        for (const tab of field.tabs as Array<Record<string, unknown>>) {
          if (Array.isArray(tab.fields)) walk(tab.fields as never)
        }
      }
    }
  }

  walk(collection.fields as never)
  return names
}

describe('Collections', () => {
  it('registers every collection the design spec calls for', () => {
    const slugs = payload.config.collections.map((c) => c.slug)
    for (const expected of ['recipes', 'cuisines', 'authors', 'brandCards', 'media', 'submissions']) {
      expect(slugs).toContain(expected)
    }
  })
})

describe('Recipes', () => {
  it('derives totalMinutes rather than trusting a hand-entered value', async () => {
    // The time facet and the JSON-LD totalTime both read this field, so it must
    // never disagree with prep + cook.
    const result = await payload.find({
      collection: 'recipes',
      where: { slug: { equals: 'mapo-tofu' } },
      limit: 1,
    })
    const doc = result.docs[0]
    expect(doc).toBeDefined()
    expect(doc.totalMinutes).toBe(doc.prepMinutes + doc.cookMinutes)
  })

  it('carries provenance on every recipe', async () => {
    // §3: provenance is load-bearing and present from commit one.
    const all = await payload.find({ collection: 'recipes', limit: 100, depth: 0 })
    expect(all.docs.length).toBeGreaterThan(0)
    for (const doc of all.docs) {
      expect(['authored', 'community', 'api-imported']).toContain(doc.provenance)
    }
  })

  it('rejects a story that runs past the word cap', async () => {
    // §1's thesis is that the long preamble is the enemy, so the cap is
    // enforced by the schema rather than by editorial goodwill.
    const tooLong = Array.from({ length: STORY_WORD_CAP + 25 }, (_, i) => `word${i}`).join(' ')
    const cuisine = (await payload.find({ collection: 'cuisines', limit: 1 })).docs[0]
    const author = (await payload.find({ collection: 'authors', limit: 1 })).docs[0]

    await expect(
      payload.create({
        collection: 'recipes',
        data: {
          title: 'Story cap probe',
          slug: 'story-cap-probe',
          story: story(tooLong),
          servings: 2,
          ingredients: [{ item: 'salt' }],
          steps: [{ text: 'Season.' }],
          cuisine: cuisine.id,
          author: author.id,
          spiciness: 0,
          sweetness: 0,
          richness: 0,
          effort: 0,
          prepMinutes: 1,
          cookMinutes: 1,
          difficulty: 'easy',
          provenance: 'authored',
          status: 'draft',
        } as never,
      }),
    ).rejects.toThrow()
  })
})

describe('Submissions', () => {
  it('mirrors the recipe body and facets so community content needs no migration', () => {
    // §5 requires submissions to mirror recipes. Both compose the same field
    // factories; this asserts the two cannot silently drift apart.
    const recipeFields = fieldNames(payload, 'recipes')
    const submissionFields = fieldNames(payload, 'submissions')

    const shared = [
      'title', 'heroImage', 'story', 'servings', 'ingredients', 'steps',
      'cuisine', 'spiciness', 'sweetness', 'richness', 'effort',
      'dietaryTags', 'prepMinutes', 'cookMinutes', 'totalMinutes', 'difficulty',
    ]

    for (const name of shared) {
      expect(recipeFields, `recipes should define ${name}`).toContain(name)
      expect(submissionFields, `submissions should define ${name}`).toContain(name)
    }

    // Plus the moderation workflow the community phase will need.
    expect(submissionFields).toContain('moderationStatus')
    expect(submissionFields).toContain('submittedBy')
  })
})
