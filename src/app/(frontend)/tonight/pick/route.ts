import { NextResponse, type NextRequest } from 'next/server'

import { getPayloadClient } from '@/lib/queries'
import { formatMinutes } from '@/lib/format'
import { imageFrom } from '@/lib/media'
import { TASTE_AXES, type TasteAxis } from '@/lib/taxonomy'

/**
 * The decision engine behind "pick dinner for me": five answers in, ONE
 * confident recipe out. No grid, no second-guessing — the reroll excludes
 * what's already been shown so "another one" always moves forward.
 *
 * Scoring is taste distance. Flavour axes count the absolute gap to the
 * preference; effort is asymmetric — a dish easier than asked barely costs,
 * a dish harder than asked costs double, because overshooting effort on a
 * weeknight is how dinner becomes a takeaway.
 */
export const dynamic = 'force-dynamic'

function clampLevel(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isNaN(n) ? 2 : Math.max(0, Math.min(5, n))
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const prefs: Record<TasteAxis, number> = {
    spiciness: clampLevel(params.get('spiciness')),
    sweetness: clampLevel(params.get('sweetness')),
    richness: clampLevel(params.get('richness')),
    effort: clampLevel(params.get('effort')),
  }
  const timeRaw = params.get('time')
  const maxMinutes = timeRaw ? Number.parseInt(timeRaw, 10) : null
  const exclude = (params.get('not') ?? '')
    .split(',')
    .map((id) => Number.parseInt(id, 10))
    .filter((id) => !Number.isNaN(id))

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'recipes',
    where: {
      and: [
        { status: { equals: 'published' } },
        { course: { equals: 'dinner' } },
        ...(maxMinutes ? [{ totalMinutes: { less_than_equal: maxMinutes } }] : []),
        ...(exclude.length > 0 ? [{ id: { not_in: exclude } }] : []),
      ],
    } as never,
    depth: 1,
    limit: 400,
  })

  const scored = result.docs
    .map((recipe) => {
      let score = 0
      for (const axis of TASTE_AXES) {
        const gap = recipe[axis] - prefs[axis]
        if (axis === 'effort') {
          score += gap > 0 ? gap * 2 : Math.abs(gap) * 0.5
        } else {
          score += Math.abs(gap)
        }
      }
      return { recipe, score }
    })
    .sort((a, b) => a.score - b.score)

  const best = scored[0]
  if (!best) {
    return NextResponse.json({ pick: null, remaining: 0 })
  }

  const recipe = best.recipe
  const cuisine = typeof recipe.cuisine === 'object' ? recipe.cuisine : null

  return NextResponse.json(
    {
      pick: {
        id: recipe.id,
        slug: recipe.slug,
        title: recipe.title,
        cuisine: cuisine?.name ?? null,
        cuisineFlag: cuisine?.flagEmoji ?? null,
        totalLabel: formatMinutes(recipe.totalMinutes),
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        calories: recipe.nutrition?.calories ?? null,
        taste: {
          spiciness: recipe.spiciness,
          sweetness: recipe.sweetness,
          richness: recipe.richness,
          effort: recipe.effort,
        },
        image: imageFrom(recipe.heroImage, 'hero'),
      },
      remaining: scored.length - 1,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
