import { NextResponse, type NextRequest } from 'next/server'

import { parseFilters, type RawSearchParams } from '@/lib/filters'
import { findRecipes } from '@/lib/queries'
import { limited } from '@/lib/rateLimit'

/**
 * JSON feed behind the catalog's scroll-to-load: same filter grammar as the
 * page itself (parseFilters over the query string), one page of results per
 * call. The page renders batch one server-side; this serves the rest as the
 * reader scrolls, so a 10,000-recipe catalog never renders 10,000 cards.
 */
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

export async function GET(request: NextRequest) {
  // Public and database-backed. Scroll-loading fires this legitimately several times a minute; the cap only
  // catches a script paging the whole catalog.
  const rl = limited(request, { name: 'recipes-feed', limit: 60, windowMs: 60000 })
  if (rl) return rl

  const raw: RawSearchParams = {}
  for (const key of request.nextUrl.searchParams.keys()) {
    const all = request.nextUrl.searchParams.getAll(key)
    raw[key] = all.length > 1 ? all : all[0]
  }
  const filters = parseFilters(raw)
  const { recipes, totalPages, page } = await findRecipes(filters, {
    page: filters.page,
    limit: PAGE_SIZE,
  })
  return NextResponse.json(
    { recipes, totalPages, page },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  )
}
