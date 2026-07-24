import { NextResponse, type NextRequest } from 'next/server'

import { searchUrl } from '@/lib/grocery'
import { logGroceryEvent, viewerCountry } from '@/lib/groceryData'
import { getPayloadClient } from '@/lib/queries'

/**
 * Click tracker + redirect for "Shop this list". The destination is rebuilt
 * from the retailer record's template (never from the query string), so this
 * can't become an open redirect — the client supplies only a retailer id and
 * the ingredient term.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const home = new URL('/plan', request.url)
  const retailerId = request.nextUrl.searchParams.get('r')
  const query = request.nextUrl.searchParams.get('q')?.trim()
  if (!retailerId || !query) return NextResponse.redirect(home)

  const payload = await getPayloadClient()
  const retailer = await payload
    .findByID({ collection: 'groceryRetailers', id: Number(retailerId), depth: 0 })
    .catch(() => null)
  if (!retailer || retailer.active === false) return NextResponse.redirect(home)

  let dest: URL
  try {
    dest = new URL(searchUrl(retailer, query))
    if (dest.protocol !== 'http:' && dest.protocol !== 'https:') throw new Error('scheme')
  } catch {
    return NextResponse.redirect(home)
  }

  await logGroceryEvent('click', retailer.id, await viewerCountry())

  return NextResponse.redirect(dest.toString(), { status: 302 })
}
