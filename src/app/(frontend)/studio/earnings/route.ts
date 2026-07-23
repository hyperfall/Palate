import { NextResponse } from 'next/server'

import { getPayloadClient } from '@/lib/queries'
import { serverUser } from '@/lib/supabase/server'

/**
 * A creator's estimated partner earnings, computed from real impression counts
 * and each card's agreed CPM × revenue share. Server-authed: only ever the
 * caller's own recipes (author matched to their Supabase id). Estimated, not a
 * payout — the UI says so — but every number traces to a logged impression.
 */
export const dynamic = 'force-dynamic'

const idOf = (v: unknown): number | null =>
  typeof v === 'object' && v ? ((v as { id?: number }).id ?? null) : typeof v === 'number' ? v : null

export async function GET() {
  const empty = { totalCents: 0, recipes: [] as unknown[] }
  const user = await serverUser()
  if (!user) return NextResponse.json(empty)

  const payload = await getPayloadClient()

  const authors = await payload.find({
    collection: 'authors',
    where: { creatorId: { equals: user.id } },
    limit: 1,
  })
  const author = authors.docs[0]
  if (!author) return NextResponse.json(empty)

  const recipes = await payload.find({
    collection: 'recipes',
    where: { author: { equals: author.id } },
    limit: 500,
    depth: 0,
  })
  if (recipes.docs.length === 0) return NextResponse.json(empty)

  const events = await payload.find({
    collection: 'adEvents',
    where: { recipe: { in: recipes.docs.map((r) => r.id) } },
    depth: 1,
    limit: 100_000,
  })

  const acc = new Map<number, { impressions: number; clicks: number; cents: number }>()
  for (const ev of events.docs) {
    const rid = idOf(ev.recipe)
    if (rid == null) continue
    const cur = acc.get(rid) ?? { impressions: 0, clicks: 0, cents: 0 }
    if (ev.kind === 'click') {
      cur.clicks++
    } else {
      cur.impressions++
      const card = ev.brandCard
      if (card && typeof card === 'object') {
        const cpm = (card as { cpmCents?: number }).cpmCents ?? 0
        const share = (card as { revSharePercent?: number }).revSharePercent ?? 0
        cur.cents += (cpm / 1000) * (share / 100)
      }
    }
    acc.set(rid, cur)
  }

  const rows = recipes.docs
    .map((r) => {
      const a = acc.get(r.id) ?? { impressions: 0, clicks: 0, cents: 0 }
      return {
        title: r.title,
        slug: r.slug,
        impressions: a.impressions,
        clicks: a.clicks,
        earningsCents: Math.round(a.cents * 100) / 100,
      }
    })
    .filter((r) => r.impressions > 0 || r.clicks > 0)
    .sort((a, b) => b.earningsCents - a.earningsCents || b.impressions - a.impressions)

  const totalCents = rows.reduce((s, r) => s + r.earningsCents, 0)
  return NextResponse.json({ totalCents, recipes: rows })
}
