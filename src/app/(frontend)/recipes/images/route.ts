import { NextResponse, type NextRequest } from 'next/server'

import { cardImagesForSlugs } from '@/lib/recipeImages'

/**
 * Current card images for a batch of recipe slugs, as a slug → url map.
 *
 * The saved-recipes shelf is a client component reading snapshotted image URLs
 * out of Supabase, and those go stale whenever the media library changes. It
 * can't call Payload directly, so it asks here. Public data only — every recipe
 * returned is already published and visible on its own page — so no auth gate,
 * matching how the recipe pages themselves are served.
 *
 * Lives outside `/api` because Payload owns that path.
 */
export const dynamic = 'force-dynamic'

/** Cap the batch: a shelf is a page of saves, not the whole catalogue. */
const MAX_SLUGS = 60

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('slugs') ?? ''
  const slugs = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SLUGS)

  if (slugs.length === 0) {
    return NextResponse.json({ images: {} }, { headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const map = await cardImagesForSlugs(slugs)
    return NextResponse.json(
      { images: Object.fromEntries(map) },
      // Per-user shelf contents, but the map itself is public recipe data;
      // a short private cache is safe and spares repeat renders a round trip.
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    )
  } catch {
    // A stale thumbnail is a smaller failure than an empty shelf.
    return NextResponse.json({ images: {} }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
