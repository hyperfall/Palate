import type { RawSearchParams } from './filters'

/**
 * Editorial collection landing pages — SEO-friendly browse pages built from the
 * catalog facets. Each is just a preset of filter params run through the same
 * parseFilters → findRecipes path the catalog uses, so they can never drift from
 * the real filtering. New collections are a one-line addition here.
 */
export type Collection = {
  slug: string
  title: string
  blurb: string
  params: RawSearchParams
}

export const COLLECTIONS: Collection[] = [
  {
    slug: 'one-pan-dinners',
    title: 'One-pan dinners',
    blurb: 'Everything in a single pan or pot: less washing up, same big flavour.',
    params: { onepan: '1' },
  },
  {
    slug: 'under-2-a-serving',
    title: 'Under £2 a serving',
    blurb: 'Proper dinners that keep the cost per plate down.',
    params: { cost: '200' },
  },
  {
    slug: 'vegan-weeknight',
    title: 'Vegan weeknight',
    blurb: 'Plant-based and on the table in half an hour.',
    params: { diet: 'vegan', time: '30' },
  },
  {
    slug: 'no-cook',
    title: 'No-cook',
    blurb: 'Not a hob in sight. Assembled, blitzed, or dressed and done.',
    params: { equip: 'no-cook' },
  },
  {
    slug: 'batch-and-keep',
    title: 'Batch & keep',
    blurb: 'Cook once, eat all week: dishes that keep and reheat well.',
    params: { keeps: '1' },
  },
  {
    slug: 'top-rated',
    title: 'Top rated',
    blurb: 'The recipes the community rates highest.',
    params: { sort: 'top' },
  },
]

export function findCollection(slug: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.slug === slug)
}
