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

/** Log one impression per served card. Runs the writes in parallel. */
export async function logImpressions(
  recipeId: number | string,
  cardIds: Array<number | string>,
): Promise<void> {
  await Promise.all(cardIds.map((id) => logAdEvent('impression', id, recipeId)))
}
