import { NextResponse, type NextRequest } from 'next/server'

import { getPayloadClient } from '@/lib/queries'

/**
 * Ingredient autocomplete for the cook-from-what-I-have flow. Matches the
 * canonical `ingredients` collection by name or alias, case-insensitive
 * contains — short queries return nothing rather than the whole catalog.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ suggestions: [] })

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'ingredients',
    where: { or: [{ name: { like: q } }, { aliases: { like: q } }] },
    limit: 8,
    depth: 0,
    sort: 'name',
  })
  const suggestions = result.docs.map((d) => ({ slug: String(d.slug), name: String(d.name) }))
  return NextResponse.json({ suggestions })
}
