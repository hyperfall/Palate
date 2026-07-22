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
  return NextResponse.json({ dishes })
}
