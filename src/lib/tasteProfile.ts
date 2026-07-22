/**
 * Taste-profile inference. The onboarding shows a few known dishes; each carries
 * the same 4 taste axes the rest of the app uses. A visitor's profile is the
 * average of the dishes they liked — a point in taste space we can seed /tonight
 * with and rank the catalog against. Pure; no I/O.
 */
export const TASTE_AXES = ['spiciness', 'sweetness', 'richness', 'effort'] as const
export type TasteAxis = (typeof TASTE_AXES)[number]
export type TasteVector = Record<TasteAxis, number>

export type DishRating = { liked: boolean; dish: TasteVector }

const clamp = (n: number) => Math.max(0, Math.min(5, Math.round(n)))

/** The centroid of the liked dishes, per axis. Null when nothing was liked. */
export function inferProfile(ratings: DishRating[]): TasteVector | null {
  const liked = ratings.filter((r) => r.liked).map((r) => r.dish)
  if (liked.length === 0) return null
  const out = { spiciness: 0, sweetness: 0, richness: 0, effort: 0 } as TasteVector
  for (const axis of TASTE_AXES) {
    out[axis] = clamp(liked.reduce((s, d) => s + (d[axis] ?? 0), 0) / liked.length)
  }
  return out
}

/** Euclidean distance in taste space — smaller is a closer match. */
export function distance(a: TasteVector, b: TasteVector): number {
  return Math.sqrt(TASTE_AXES.reduce((s, axis) => s + ((a[axis] ?? 0) - (b[axis] ?? 0)) ** 2, 0))
}

/** Compact URL encoding, e.g. {2,1,3,2} → "2-1-3-2". */
export function encodeVector(v: TasteVector): string {
  return TASTE_AXES.map((axis) => clamp(v[axis] ?? 0)).join('-')
}

/** Parse "2-1-3-2" back into a vector; null when malformed/out of range. */
export function parseVector(raw: string | undefined | null): TasteVector | null {
  if (!raw) return null
  const parts = raw.split('-')
  if (parts.length !== TASTE_AXES.length) return null
  const nums = parts.map((p) => Number.parseInt(p, 10))
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 5)) return null
  return { spiciness: nums[0], sweetness: nums[1], richness: nums[2], effort: nums[3] }
}
