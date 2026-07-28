import { NextResponse } from 'next/server'

import { formatMinutes } from '@/lib/format'
import { imageFrom } from '@/lib/media'
import { findFeaturedRecipes } from '@/lib/queries'

/** Real dishes for the quiz's image round — lazy-loaded when the popup opens. */
export const dynamic = 'force-dynamic'

export async function GET() {
  const recipes = await findFeaturedRecipes(12)
  const dishes = recipes.map((recipe) => ({
    title: recipe.title,
    image: imageFrom(recipe.heroImage, 'card')?.url ?? null,
    cuisine: typeof recipe.cuisine === 'object' ? (recipe.cuisine?.name ?? null) : null,
    totalLabel: formatMinutes(recipe.totalMinutes),
  }))
  // The quiz popup can open many times a session and the dish set changes on
  // the ISR cadence, not per request — the sibling page renders the identical
  // query with revalidate 3600. Let the CDN and browser hold it briefly.
  return NextResponse.json(
    { dishes },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' } },
  )
}
