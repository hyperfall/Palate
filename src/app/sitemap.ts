import type { MetadataRoute } from 'next'

import { countRecipesByCuisine, findAllRecipeSlugs, findCuisines } from '@/lib/queries'
import { absoluteUrl } from '@/lib/site'

export const revalidate = 3600

/** §8: sitemap covering the recipe and cuisine pages that carry the SEO weight. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [recipes, cuisines, counts] = await Promise.all([
    findAllRecipeSlugs(),
    findCuisines(),
    countRecipesByCuisine(),
  ])

  // Only sitemap hubs that have recipes — an empty world-cuisine hub is
  // noindex'd anyway, and shipping 200 of them wastes crawl budget.
  const activeCuisines = cuisines.filter((c) => (counts.get(String(c.id)) ?? 0) > 0)

  return [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/recipes'), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/cuisines'), changeFrequency: 'weekly', priority: 0.7 },
    ...activeCuisines.map((cuisine) => ({
      url: absoluteUrl(`/cuisine/${cuisine.slug}`),
      lastModified: cuisine.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...recipes.map((recipe) => ({
      url: absoluteUrl(`/recipes/${recipe.slug}`),
      lastModified: recipe.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ]
}
