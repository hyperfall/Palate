import { sql } from '@payloadcms/db-postgres/drizzle'

import { getPayloadClient } from '@/lib/queries'

/**
 * Record partner-card telemetry. Best-effort: a failed write must never break
 * an ad slot or a click redirect, so everything is swallowed and logged.
 */
export async function logAdEvent(
  kind: 'impression' | 'click',
  brandCardId: number | string,
  recipeId: number | string,
): Promise<void> {
  try {
    const payload = await getPayloadClient()
    await payload.create({
      collection: 'adEvents',
      data: { kind, brandCard: Number(brandCardId), recipe: Number(recipeId) } as never,
    })
  } catch (err) {
    console.error('[adEvents] log failed:', err)
  }
}

/**
 * Log one impression per served card, and advance each card's counter.
 *
 * The counter is denormalised onto the card on purpose. Selection runs on every
 * slot render and has to know whether a campaign has spent its buy; counting
 * rows in adEvents to answer that would put an aggregate query in front of
 * every impression. The log stays the record of truth — the counter is a
 * running total that selection can read for free, and it is recomputable from
 * the log if it ever drifts.
 *
 * Best-effort throughout: a partner card is never worth breaking a recipe over.
 */
export async function logImpressions(
  recipeId: number | string,
  cardIds: Array<number | string>,
): Promise<void> {
  await Promise.all([
    ...cardIds.map((id) => logAdEvent('impression', id, recipeId)),
    ...cardIds.map((id) => countImpression(id)),
  ])
}

async function countImpression(cardId: number | string): Promise<void> {
  try {
    const payload = await getPayloadClient()
    // Atomic increment, not read-then-write. The old findByID + update raced:
    // two concurrent slot renders both read the same value and both wrote it
    // + 1, losing one count. The counter can only ever drift LOW that way, and
    // isWithinBudget gates on impressionsServed < cap — so a lost count lets a
    // capped campaign serve past the buy it was paid for. A single UPDATE ...
    // SET x = x + 1 has no window to lose. The adEvents log is unaffected either
    // way; this only keeps the denormalised counter honest.
    const db = (payload.db as { drizzle: { execute: (q: unknown) => Promise<unknown> } }).drizzle
    await db.execute(
      sql`UPDATE brand_cards SET impressions_served = COALESCE(impressions_served, 0) + 1 WHERE id = ${Number(cardId)}`,
    )
  } catch (err) {
    console.error('[adEvents] impression count failed:', err)
  }
}
