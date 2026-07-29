import { headers } from 'next/headers'

import { retailersForCountry } from '@/lib/grocery'
import { RETAILERS } from '@/seed/groceryRetailerData'
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

/**
 * Every active retailer, unfiltered — the client-side country picker's menu.
 *
 * Falls back to the committed registry when the database has none. A fresh
 * production database starts empty, and requiring a seed run before the shop
 * panel works meant the feature silently didn't exist until someone remembered
 * a command. The committed list is the same data the seeder writes, so the
 * fallback is never stale relative to a deploy; the moment rows exist they win,
 * because those carry admin edits and affiliate templates.
 */
export async function getAllGroceryRetailers(): Promise<GroceryRetailer[]> {
  try {
    const payload = await getPayloadClient()
    const { docs } = await payload.find({
      collection: 'groceryRetailers',
      where: { active: { equals: true } },
      // The registry is ~70 rows; the cap exists only so a runaway admin import
      // can't ship megabytes to every plan page.
      limit: 200,
      depth: 0,
    })
    if (docs.length > 0) return docs
  } catch (err) {
    console.error('[grocery] retailer fetch failed:', err)
  }
  return fallbackRetailers()
}

/**
 * The committed registry, shaped like Payload docs. Ids are slugs rather than
 * numbers — /grocery/click resolves a retailer by id, and it accepts a slug for
 * exactly this case, so links work before anything is seeded.
 */
export function fallbackRetailerBySlug(slug: string): GroceryRetailer | null {
  return fallbackRetailers().find((r) => r.slug === slug) ?? null
}

function fallbackRetailers(): GroceryRetailer[] {
  return RETAILERS.map(
    (r) =>
      ({
        id: r.slug,
        label: r.label,
        slug: r.slug,
        type: r.type,
        countries: r.countries.map((code) => ({ code })),
        searchUrlTemplate: r.searchUrlTemplate,
        priority: r.priority,
        active: true,
        network: 'none',
      }) as unknown as GroceryRetailer,
  )
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
