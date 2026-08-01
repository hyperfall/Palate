import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

import { logAdEvent } from '@/lib/adEvents'
import { findRecipeBySlug, getPayloadClient } from '@/lib/queries'
import { limited } from '@/lib/rateLimit'
import { VISITOR_COOKIE } from '@/proxy'

/**
 * Click tracker + redirect for partner cards. The destination is read from the
 * brand-card record (never from the query string), so this can't be turned into
 * an open redirect — the client only supplies the card id and recipe slug.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const home = new URL('/', request.url)
  // Logs a click event on every hit; rate-limit so it can't be scripted to
  // pollute CTR. Redirect the excess home rather than 429 — a person clicking
  // fast should still land somewhere sensible.
  const visitorKey = (await cookies()).get(VISITOR_COOKIE)?.value ?? null
  if (limited(request, { name: 'brand-click', id: visitorKey, limit: 40, windowMs: 60_000 })) {
    return NextResponse.redirect(home)
  }
  const cardId = request.nextUrl.searchParams.get('card')
  const slug = request.nextUrl.searchParams.get('recipe')
  if (!cardId) return NextResponse.redirect(home)

  const payload = await getPayloadClient()
  const card = await payload
    .findByID({ collection: 'brandCards', id: Number(cardId) })
    .catch(() => null)
  if (!card?.ctaUrl) return NextResponse.redirect(home)

  let dest: URL
  try {
    dest = new URL(card.ctaUrl)
    if (dest.protocol !== 'http:' && dest.protocol !== 'https:') throw new Error('scheme')
  } catch {
    return NextResponse.redirect(home)
  }

  const recipe = slug ? await findRecipeBySlug(slug) : null
  if (recipe) await logAdEvent('click', card.id, recipe.id)

  return NextResponse.redirect(dest.toString(), { status: 302 })
}
