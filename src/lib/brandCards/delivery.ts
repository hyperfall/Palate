/**
 * The figures the admin's delivery panel reports.
 *
 * Pure, because every one of these numbers has a way of going wrong that a
 * component is a bad place to discover: a click rate divided by zero
 * impressions, a progress bar past 100%, a cap of zero read as "no cap".
 */

export type DeliveryInput = {
  impressions: number
  clicks: number
  /** The running counter on the card. */
  served: number
  /** The buy, or null/0 for uncapped. */
  cap?: number | null
}

export type DeliveryFigures = {
  /** Formatted percentage, or null when there is nothing to divide by. */
  ctr: string | null
  /** Progress against the cap, 0–100. Null when uncapped. */
  percentServed: number | null
  /** Has the buy been fully served? */
  spent: boolean
}

export function deliveryFigures({ impressions, clicks, served, cap }: DeliveryInput): DeliveryFigures {
  // A card can log a click with no counted impression (an old row, a lost
  // write). Reporting Infinity% would look like a bug in the ad system rather
  // than a gap in the log.
  const ctr = impressions > 0 ? `${((clicks / impressions) * 100).toFixed(2)}%` : null

  const capped = typeof cap === 'number' && Number.isFinite(cap) && cap > 0
  const percentServed = capped ? Math.min(100, Math.max(0, Math.round((served / cap) * 100))) : null
  // A cap of exactly zero is a paused campaign, not an uncapped one — the same
  // distinction the selector makes, kept in step here.
  const spent = typeof cap === 'number' && Number.isFinite(cap) && cap >= 0 ? served >= cap : false

  return { ctr, percentServed, spent }
}
