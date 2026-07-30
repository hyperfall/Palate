import type { MetadataRoute } from 'next'

import { COLLECTIONS } from '@/lib/collections'
import {
  countRecipesByCuisine,
  findAllRecipeSlugs,
  findAuthorsWithHandles,
  findCuisines,
  findUsedIngredientSlugs,
} from '@/lib/queries'
import { absoluteUrl } from '@/lib/site'

export const revalidate = 3600

/** §8: sitemap covering the recipe and cuisine pages that carry the SEO weight. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [recipes, cuisines, counts, authors, ingredientSlugs] = await Promise.all([
    findAllRecipeSlugs(),
    findCuisines(),
    countRecipesByCuisine(),
    findAuthorsWithHandles(),
    findUsedIngredientSlugs(),
  ])

  // Only sitemap hubs that have recipes — an empty world-cuisine hub is
  // noindex'd anyway, and shipping 200 of them wastes crawl budget.
  const activeCuisines = cuisines.filter((c) => (counts.get(String(c.id)) ?? 0) > 0)

  return [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/recipes'), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/cuisines'), changeFrequency: 'weekly', priority: 0.7 },
    { url: absoluteUrl('/browse'), changeFrequency: 'weekly', priority: 0.7 },
    { url: absoluteUrl('/ingredients'), changeFrequency: 'weekly', priority: 0.7 },
    // The board: all-time plus the current month and year. Daily and weekly
    // permalinks exist and work, but sitemapping every past day would be
    // thousands of near-empty pages spending crawl budget on nothing.
    { url: absoluteUrl('/ranking/all'), changeFrequency: 'daily', priority: 0.7 },
    ...(() => {
      const now = new Date()
      const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
      return [
        { url: absoluteUrl(`/ranking/${month}`), changeFrequency: 'daily' as const, priority: 0.6 },
        { url: absoluteUrl(`/ranking/${now.getUTCFullYear()}`), changeFrequency: 'daily' as const, priority: 0.6 },
      ]
    })(),
    ...COLLECTIONS.map((c) => ({
      url: absoluteUrl(`/browse/${c.slug}`),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...authors
      .filter((a) => a.handle)
      .map((a) => ({
        url: absoluteUrl(`/creator/${a.handle}`),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ...activeCuisines.map((cuisine) => ({
      url: absoluteUrl(`/cuisine/${cuisine.slug}`),
      lastModified: cuisine.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    // Only ingredients a recipe actually uses have a page — the same rule the
    // route's generateStaticParams applies, so the sitemap can't advertise a
    // URL that 404s.
    ...ingredientSlugs.map((slug) => ({
      url: absoluteUrl(`/ingredients/${slug}`),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...recipes.map((recipe) => ({
      url: absoluteUrl(`/recipes/${recipe.slug}`),
      lastModified: recipe.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ]
}
