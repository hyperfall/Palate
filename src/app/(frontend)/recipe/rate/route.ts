import { NextResponse, type NextRequest } from 'next/server'

import { getPayloadClient } from '@/lib/queries'
import { limited } from '@/lib/rateLimit'
import { syncRecipeRating } from '@/lib/ratingSync'
import { serverUser } from '@/lib/supabase/server'

/**
 * Community rating write/read. Any signed-in user may rate a published recipe
 * 1–5 stars, once — re-rating updates their existing vote. The recipe's
 * denormalised aggregate (`ratingSum` / `ratingCount`) is maintained here in the
 * same request, so the catalog never has to aggregate the ratings collection.
 *
 * Outside `/api` because Payload owns that path.
 */
export const dynamic = 'force-dynamic'

const asRecipeId = (raw: unknown): number | null => {
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw)
  return null
}

const average = (sum: number, count: number): number =>
  count > 0 ? Math.round((sum / count) * 100) / 100 : 0

/** The viewer's own vote for a recipe (null if none / signed out), plus the public tally. */
export async function GET(request: NextRequest) {
  const recipeId = asRecipeId(request.nextUrl.searchParams.get('recipeId'))
  if (recipeId === null) {
    return NextResponse.json({ error: 'Missing recipeId.' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const recipe = await payload
    .findByID({ collection: 'recipes', id: recipeId, depth: 0 })
    .catch(() => null)
  // Drafts must 404 exactly like nonexistent ids — otherwise this endpoint is
  // an oracle for enumerating unpublished recipe ids and their tallies.
  if (!recipe || recipe.status !== 'published') {
    return NextResponse.json({ error: 'Recipe not found.' }, { status: 404 })
  }

  const count = recipe.ratingCount ?? 0
  const sum = recipe.ratingSum ?? 0

  const user = await serverUser()
  let yourStars: number | null = null
  if (user) {
    const mine = await payload.find({
      collection: 'ratings',
      where: { and: [{ recipe: { equals: recipeId } }, { userId: { equals: user.id } }] },
      limit: 1,
      depth: 0,
    })
    yourStars = (mine.docs[0]?.stars as number | undefined) ?? null
  }

  return NextResponse.json({ average: average(sum, count), count, yourStars })
}

export async function POST(request: NextRequest) {
  const user = await serverUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in to rate.' }, { status: 401 })
  }
  const rl = limited(request, { name: 'rate', id: user.id, limit: 30, windowMs: 5 * 60_000 })
  if (rl) return rl

  let body: { recipeId?: unknown; stars?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })
  }

  const recipeId = asRecipeId(body.recipeId)
  const stars = body.stars
  if (recipeId === null) {
    return NextResponse.json({ error: 'Missing recipeId.' }, { status: 400 })
  }
  if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: 'Stars must be a whole number from 1 to 5.' }, { status: 400 })
  }

  const payload = await getPayloadClient()

  // Only published recipes are rateable — no rating drafts.
  const recipe = await payload
    .findByID({ collection: 'recipes', id: recipeId, depth: 0 })
    .catch(() => null)
  if (!recipe || recipe.status !== 'published') {
    return NextResponse.json({ error: 'Recipe not found.' }, { status: 404 })
  }

  const existing = await payload.find({
    collection: 'ratings',
    where: { and: [{ recipe: { equals: recipeId } }, { userId: { equals: user.id } }] },
    limit: 1,
    depth: 0,
  })
  const prior = existing.docs[0]

  if (prior) {
    await payload.update({ collection: 'ratings', id: prior.id, data: { stars } })
  } else {
    await payload.create({
      collection: 'ratings',
      data: { recipe: recipeId, userId: user.id, stars },
    })
  }

  // Recompute the aggregate FROM the ratings rows rather than incrementing the
  // recipe's copy in JS — the old read-modify-write lost concurrent votes
  // permanently; recomputing converges to the source of truth on every vote.
  // (The recipe hook re-derives ratingScore from the updated sum/count.)
  const { sum, count } = await syncRecipeRating(payload, recipeId)

  return NextResponse.json({ average: average(sum, count), count, yourStars: stars })
}
