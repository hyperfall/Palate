import type { Media } from '@/payload-types'

export type MediaRef = number | string | Media | null | undefined

/** Narrows a Payload upload relationship to a populated Media doc, if it is one. */
export function asMedia(ref: MediaRef): Media | null {
  if (!ref || typeof ref !== 'object') return null
  return ref
}

export type ResolvedImage = {
  url: string
  alt: string
  width?: number
  height?: number
}

/**
 * Picks a generated size by name, falling back to the original. Payload only
 * creates a size if the source was large enough, so the fallback is load-bearing
 * rather than defensive padding.
 */
export function imageFrom(ref: MediaRef, size?: keyof NonNullable<Media['sizes']>): ResolvedImage | null {
  const media = asMedia(ref)
  if (!media) return null

  let variant = size ? media.sizes?.[size] : undefined
  // Never serve a variant that was ENLARGED past the original — a stretched
  // 800px file is blurrier than the sharp 600px source it came from. The
  // original is always the quality ceiling.
  if (variant?.width && media.width && variant.width > media.width) {
    variant = undefined
  }
  const url = variant?.url ?? media.url
  if (!url) return null

  return {
    url,
    alt: media.alt ?? '',
    width: variant?.width ?? media.width ?? undefined,
    height: variant?.height ?? media.height ?? undefined,
  }
}
