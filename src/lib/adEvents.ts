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
    const card = await payload.findByID({ collection: 'brandCards', id: cardId, depth: 0 })
    await payload.update({
      collection: 'brandCards',
      id: cardId,
      data: { impressionsServed: (card.impressionsServed ?? 0) + 1 },
    })
  } catch (err) {
    console.error('[adEvents] impression count failed:', err)
  }
}
