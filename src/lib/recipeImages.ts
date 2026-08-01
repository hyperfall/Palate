import { getPayloadClient } from '@/lib/queries'
import { imageFrom } from '@/lib/media'

/** Same published-only gate every public recipe query uses. */
const PUBLISHED = { status: { equals: 'published' } } as const

/**
 * Current card images for a set of recipe slugs, resolved live from Payload.
 *
 * The user tables in Supabase (collection_items, cook_log, meal_plan) each
 * snapshot the recipe's image URL at the moment it was saved. That snapshot
 * goes stale the instant the media library changes — re-mastering nine hero
 * photographs from .png to .jpg turned every one of those stored URLs into a
 * 404. /plan was moved to resolve images from the recipe instead; this is the
 * same fix, shared, for the other surfaces that still render the snapshot.
 *
 * Returns a slug → url map. A slug missing from the map is a recipe that no
 * longer exists (or was unpublished), and the caller falls back to whatever it
 * stored — which is the one case the snapshot is still good for.
 */
export async function cardImagesForSlugs(slugs: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(slugs.filter(Boolean))]
  const out = new Map<string, string>()
  if (unique.length === 0) return out

  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'recipes',
    where: { and: [PUBLISHED, { slug: { in: unique } }] },
    depth: 1,
    limit: unique.length,
    // Only the two fields the image needs — no reason to ship whole recipes.
    select: { slug: true, heroImage: true },
  })

  for (const doc of docs) {
    const url = imageFrom(doc.heroImage, 'card')?.url
    if (url) out.set(String(doc.slug), url)
  }
  return out
}

/**
 * Replace stored snapshot URLs with live ones where the recipe still exists.
 *
 * The generic shape both server consumers need: hand it rows carrying a slug
 * and a stored image, get the same rows back with the image refreshed. A row
 * whose recipe is gone keeps its snapshot rather than losing its picture.
 */
export async function withLiveImages<T extends { slug: string; image: string | null }>(
  rows: T[],
): Promise<T[]> {
  const live = await cardImagesForSlugs(rows.map((r) => r.slug))
  return rows.map((row) => ({ ...row, image: live.get(row.slug) ?? row.image }))
}
