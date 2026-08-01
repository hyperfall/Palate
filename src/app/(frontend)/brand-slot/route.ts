import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

import { logImpressions } from '@/lib/adEvents'
import { limited } from '@/lib/rateLimit'
import { resolveBrandCardsForRecipe } from '@/lib/brandCards/resolve'
import { findRecipeBySlug } from '@/lib/queries'
import { pickCreative } from '@/lib/brandCards/creative'
import { imageFrom } from '@/lib/media'
import { VISITOR_COOKIE } from '@/proxy'

/**
 * Per-visitor brand-card selection, served separately from the recipe page.
 *
 * Why this is its own endpoint rather than part of the page render: the card a
 * visitor sees depends on their region and rotation cookie, while the recipe
 * itself is identical for everyone. Resolving both in one render would force
 * the whole recipe route to be dynamic — losing the SSG/ISR that §8 asks for —
 * and worse, any attempt to cache that page would bake one visitor's partner
 * card into the HTML every other visitor receives.
 *
 * Splitting them lets the recipe be statically generated (§8) while the slot
 * stays correctly personalised (§6). Phase 2's targeting service slots in
 * behind `resolveBrandCardsForRecipe` without touching either side.
 *
 * Lives outside `/api` because Payload owns that path.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('recipe')
  if (!slug) {
    return NextResponse.json({ error: 'Missing recipe slug' }, { status: 400 })
  }

  // This route WRITES on every hit (an impression row + an atomic counter bump
  // that feeds the budget cap). Unlimited and unauthenticated, a script could
  // loop it to burn a rival campaign's maxImpressions to zero. Key the limit on
  // the visitor cookie, not the IP, so a shared campus network isn't throttled
  // as one caller. Generous enough that no real reader browsing recipes trips
  // it.
  const visitorKey = (await cookies()).get(VISITOR_COOKIE)?.value ?? null
  const rl = limited(request, { name: 'brand-slot', id: visitorKey, limit: 120, windowMs: 60_000 })
  if (rl) return rl

  const recipe = await findRecipeBySlug(slug)
  if (!recipe) {
    return NextResponse.json({ cards: [] })
  }

  const cards = await resolveBrandCardsForRecipe(recipe)

  // Same key the card rotation uses (see the rate limit above), so a visitor's
  // creative is stable while they browse rather than reshuffling per render.
  const rotationKey = visitorKey ?? 'anonymous'

  // A served card is an impression. Best-effort — never blocks or breaks the slot.
  if (cards.length > 0) {
    await logImpressions(
      recipe.id,
      cards.map((c) => c.id),
    )
  }

  return NextResponse.json(
    {
      cards: cards.map((card) => {
        // One image per campaign was a constraint of the schema, not of the
        // design. A card can now carry a set, rotated per visitor and salted
        // per card so two brands on a page don't both show their first image
        // to the same reader.
        const creative = pickCreative(card.creatives, rotationKey, card.id)
        return {
          id: card.id,
          brand: card.brand,
          tagline: creative?.tagline ?? card.tagline,
          ctaLabel: card.ctaLabel,
          ctaUrl: card.ctaUrl,
          image: imageFrom(
            (creative?.image as Parameters<typeof imageFrom>[0]) ?? card.productImage ?? card.logo,
            'thumbnail',
          ),
        }
      }),
    },
    // Personalised: must never be stored by a shared cache.
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
