import { NextResponse, type NextRequest } from 'next/server'

import { getPayloadClient } from '@/lib/queries'
import { limited } from '@/lib/rateLimit'

/**
 * Which days of a year carry votes, and how many.
 *
 * The date picker uses this to mark the days that have something on them. A
 * calendar where every square looks identical makes someone hunt blindly
 * through empty boards; one that shows where the votes are turns picking a
 * date into reading the year at a glance.
 *
 * Counts only — no recipe, no user, nothing a scraper would want. Days are
 * keyed in UTC to match the ranking buckets.
 */
export const revalidate = 300

export async function GET(request: NextRequest) {
  // Public and database-backed, like the other read endpoints. Generous:
  // the picker asks once per year navigated, and this keys on IP.
  const rl = limited(request, { name: 'vote-days', limit: 300, windowMs: 60_000 })
  if (rl) return rl

  const year = Number(request.nextUrl.searchParams.get('year'))
  // A sane window: a hand-typed year of 90210 shouldn't build a query.
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Bad year.' }, { status: 400 })
  }

  const start = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year + 1, 0, 1))

  try {
    const payload = await getPayloadClient()
    const ratings = await payload.find({
      collection: 'ratings',
      where: {
        and: [
          { createdAt: { greater_than_equal: start.toISOString() } },
          { createdAt: { less_than: end.toISOString() } },
        ],
      },
      pagination: false,
      limit: 20_000,
      depth: 0,
      select: { createdAt: true },
    })

    const days: Record<string, number> = {}
    for (const r of ratings.docs) {
      const iso = new Date(r.createdAt as string).toISOString().slice(0, 10)
      days[iso] = (days[iso] ?? 0) + 1
    }
    return NextResponse.json({ year, days })
  } catch {
    // The picker still works without markers — it just can't show where the
    // votes are, which is a degraded calendar rather than a broken one.
    return NextResponse.json({ year, days: {} })
  }
}
