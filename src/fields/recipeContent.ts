import type { Field } from 'payload'

import {
  COURSES,
  DIETARY_TAGS,
  DIFFICULTIES,
  MAIN_INGREDIENTS,
  TASTE_AXES,
  TASTE_AXIS_LABELS,
} from '../lib/taxonomy'
import { countWords } from '../lib/lexical'
import { STORY_MARKDOWN_CAP } from '../lib/recipeLimits'

/**
 * §5 caps the story in the editor UI. The number is deliberately small: the
 * whole product thesis (§1) is that the 900-word life story is the enemy.
 */
export const STORY_WORD_CAP = 120

/**
 * The recipe body, shared by `recipes` and `submissions`.
 *
 * §5 says `submissions` "mirrors `recipes`" so community content slots in
 * without a migration. Mirroring by hand is how the two drift apart, so both
 * collections compose these same field arrays — `recipes` wraps them in
 * editor tabs, `submissions` uses them flat.
 */
export function recipeBodyFields({ requireHero = true }: { requireHero?: boolean } = {}): Field[] {
  return [
    { name: 'title', type: 'text', required: true },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      required: requireHero,
      admin: { description: 'Food photography is the product. This one is not optional.' },
    },
    { name: 'gallery', type: 'upload', relationTo: 'media', hasMany: true },
    {
      name: 'story',
      label: 'Notes',
      type: 'richText',
      admin: {
        description: `Short notes, capped at ${STORY_WORD_CAP} words. Renders *below* the recipe — never blocks the cook.`,
      },
      validate: (value: unknown) => {
        const words = countWords(value as never)
        if (words > STORY_WORD_CAP) {
          return `Notes are ${words} words — the cap is ${STORY_WORD_CAP}. Recipe first.`
        }
        return true
      },
    },
    {
      name: 'storyMarkdown',
      type: 'textarea',
      maxLength: STORY_MARKDOWN_CAP,
      admin: {
        description:
          'Optional long-form Story in Markdown (supports images). Shown behind a Story toggle that replaces the instructions — opt-in, never the default.',
      },
    },
    {
      name: 'storyImages',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: { description: 'Images referenced by the Story markdown (hosted here so links never rot).' },
    },
    { name: 'servings', type: 'number', required: true, min: 1, defaultValue: 2 },
    {
      name: 'ingredients',
      type: 'array',
      required: true,
      minRows: 1,
      admin: { initCollapsed: false },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'quantity', type: 'text', admin: { width: '20%' } },
            { name: 'unit', type: 'text', admin: { width: '20%' } },
            { name: 'item', type: 'text', required: true, admin: { width: '60%' } },
          ],
        },
        {
          name: 'note',
          type: 'text',
          admin: { description: 'e.g. "finely diced", "room temperature"' },
        },
        {
          name: 'heading',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'This row is a section label ("To serve", "For the sauce"), not an ingredient. Skipped by matching, the shopping list, and nutrition.',
          },
        },
        {
          name: 'affiliateKey',
          type: 'text',
          admin: {
            description:
              'Optional key linking this ingredient to an affiliate product. Phase 1 stores it; Phase 2 resolves it.',
          },
        },
        {
          name: 'ingredient',
          type: 'relationship',
          relationTo: 'ingredients',
          admin: { readOnly: true, description: 'Auto-linked canonical ingredient.' },
        },
        { name: 'needsReview', type: 'checkbox', defaultValue: false, admin: { readOnly: true } },
      ],
    },
    {
      name: 'steps',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'text', type: 'textarea', required: true },
        { name: 'image', type: 'upload', relationTo: 'media' },
        {
          name: 'timerSeconds',
          type: 'number',
          min: 0,
          admin: { description: 'Optional. Renders an inline timer for this step.' },
        },
        {
          name: 'uses',
          type: 'relationship',
          relationTo: 'ingredients',
          hasMany: true,
          admin: { description: 'Canonical ingredients this step uses.' },
        },
      ],
    },
    {
      name: 'finish',
      type: 'group',
      admin: {
        description:
          'Optional. Shown on cooking mode’s finish screen — storage, reheating, and what the leftovers become.',
      },
      fields: [
        {
          name: 'storageDays',
          type: 'number',
          min: 0,
          admin: { description: 'Days it keeps refrigerated.' },
        },
        { name: 'reheat', type: 'text', admin: { description: 'e.g. "Low heat with a splash of water."' } },
        { name: 'leftoverIdeas', type: 'text', admin: { description: 'What tomorrow’s lunch becomes.' } },
      ],
    },
  ]
}

/** The facets the catalog filters on (§7), shared by `recipes` and `submissions`. */
export function recipeFacetFields(): Field[] {
  const tasteAxisFields: Field[] = TASTE_AXES.map((axis) => ({
    name: axis,
    type: 'number',
    required: true,
    defaultValue: 0,
    min: 0,
    max: 5,
    admin: {
      description: `0 = ${TASTE_AXIS_LABELS[axis].scale[0]}, 5 = ${TASTE_AXIS_LABELS[axis].scale[5]}`,
      step: 1,
    },
  }))

  return [
    { name: 'cuisine', type: 'relationship', relationTo: 'cuisines', required: true, index: true },
    {
      type: 'row',
      fields: [
        {
          name: 'course',
          type: 'select',
          required: true,
          defaultValue: 'dinner',
          options: [...COURSES],
          index: true,
        },
        {
          name: 'mainIngredient',
          type: 'select',
          required: true,
          defaultValue: 'vegetables',
          options: [...MAIN_INGREDIENTS],
          index: true,
          admin: { description: 'What the dish is built on — the shopping-list headline.' },
        },
      ],
    },
    { type: 'row', fields: tasteAxisFields },
    { name: 'dietaryTags', type: 'select', hasMany: true, options: [...DIETARY_TAGS], index: true },
    {
      type: 'row',
      fields: [
        { name: 'prepMinutes', type: 'number', required: true, min: 0, defaultValue: 0 },
        { name: 'cookMinutes', type: 'number', required: true, min: 0, defaultValue: 0 },
      ],
    },
    {
      name: 'totalMinutes',
      type: 'number',
      index: true,
      admin: { readOnly: true, description: 'Derived from prep + cook.', position: 'sidebar' },
    },
    {
      name: 'difficulty',
      type: 'select',
      required: true,
      defaultValue: 'easy',
      options: [...DIFFICULTIES],
      index: true,
    },
    {
      name: 'costPerServing',
      type: 'number',
      min: 0,
      index: true,
      admin: {
        description:
          'Pence (GBP) per serving — the seed/estimates are authored in pence; prices render with £.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'equipment',
          type: 'select',
          hasMany: true,
          index: true,
          options: [
            { label: 'Stovetop', value: 'stovetop' },
            { label: 'Oven', value: 'oven' },
            { label: 'Microwave', value: 'microwave' },
            { label: 'Grill / broiler', value: 'grill' },
            { label: 'Blender', value: 'blender' },
            { label: 'Food processor', value: 'food-processor' },
            { label: 'Slow cooker', value: 'slow-cooker' },
            { label: 'Air fryer', value: 'air-fryer' },
            { label: 'No-cook', value: 'no-cook' },
          ],
          admin: { description: 'Kitchen-reality filter: what a cook needs to make this.' },
        },
        { name: 'onePan', type: 'checkbox', defaultValue: false, index: true, admin: { description: 'Cooks in a single pan/pot.' } },
        { name: 'makeAhead', type: 'checkbox', defaultValue: false, index: true, admin: { description: 'Can be partly or fully made in advance.' } },
      ],
    },
    {
      name: 'nutrition',
      type: 'group',
      admin: { description: 'Optional. Feeds Recipe JSON-LD when present.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'calories', type: 'number', min: 0 },
            { name: 'protein', type: 'number', min: 0, admin: { description: 'grams' } },
            { name: 'carbs', type: 'number', min: 0, admin: { description: 'grams' } },
            { name: 'fat', type: 'number', min: 0, admin: { description: 'grams' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'saturates', type: 'number', min: 0, admin: { description: 'grams' } },
            { name: 'sugars', type: 'number', min: 0, admin: { description: 'grams' } },
            { name: 'fibre', type: 'number', min: 0, admin: { description: 'grams' } },
            { name: 'salt', type: 'number', min: 0, admin: { description: 'grams' } },
            {
              name: 'servingGrams',
              type: 'number',
              min: 0,
              admin: { description: 'Estimated grams per serving — derives per-100g values for FSA traffic lights.' },
            },
          ],
        },
      ],
    },
  ]
}

/** Keep `totalMinutes` derived — the time facet and JSON-LD totalTime must not disagree. */
export function deriveTotalMinutes(data: Record<string, unknown>): void {
  const prep = Number(data?.prepMinutes ?? 0)
  const cook = Number(data?.cookMinutes ?? 0)
  data.totalMinutes = prep + cook
}
