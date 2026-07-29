import { headers } from 'next/headers'

import { retailersForCountry } from '@/lib/grocery'
import { getPayloadClient } from '@/lib/queries'
import type { GroceryRetailer } from '@/payload-types'

/**
 * Server-side "Shop this list" selection: viewer country (Vercel geo header,
 * env fallback for dev) → eligible retailers, with one impression event logged
 * per retailer shown. Best-effort throughout — a broken registry must never
 * break the plan page.
 */

export async function viewerCountry(): Promise<string | null> {
  const headerList = await headers()
  return headerList.get('x-vercel-ip-country') ?? process.env.GROCERY_DEFAULT_COUNTRY ?? 'GB'
}

export async function getGroceryRetailers(country: string | null): Promise<GroceryRetailer[]> {
  return retailersForCountry(await getAllGroceryRetailers(), country)
}

/** Every active retailer, unfiltered — the client-side country picker's menu. */
export async function getAllGroceryRetailers(): Promise<GroceryRetailer[]> {
  try {
    const payload = await getPayloadClient()
    const { docs } = await payload.find({
      collection: 'groceryRetailers',
      where: { active: { equals: true } },
      // The registry is ~70 rows and the cap exists only so a runaway admin
      // import can't ship megabytes to every plan page.
      limit: 200,
      depth: 0,
    })
    return docs
  } catch (err) {
    console.error('[grocery] retailer fetch failed:', err)
    return []
  }
}

export async function logGroceryEvent(
  kind: 'impression' | 'click',
  retailerId: number | string,
  country: string | null,
): Promise<void> {
  try {
    const payload = await getPayloadClient()
    await payload.create({
      collection: 'groceryEvents',
      data: { kind, retailer: Number(retailerId), country: country ?? undefined },
    })
  } catch (err) {
    console.error('[grocery] event log failed:', err)
  }
}

/** One impression per retailer shown, in parallel (per-retailer CTR needs this). */
export async function logGroceryImpressions(
  retailerIds: Array<number | string>,
  country: string | null,
): Promise<void> {
  await Promise.all(retailerIds.map((id) => logGroceryEvent('impression', id, country)))
}
