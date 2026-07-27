import { existsSync } from 'node:fs'
import path from 'node:path'

/**
 * Animated cuisine cards, wired by filename convention: drop a video at
 * `media/animated/<cuisine-slug>.mp4` (or .webm) and the cuisine picks it up —
 * no per-cuisine admin wiring. Anything without a video falls back to its
 * hero image exactly as before.
 *
 * The cuisines page revalidates hourly (ISR), so a newly dropped file appears
 * within the hour — or immediately on the next dev restart / deploy.
 *
 * NOTE for the eventual Vercel deploy: serverless functions don't ship the
 * media/ directory — production media lives in Blob storage, and this
 * detection will need to point there. Fine for local/self-hosted today.
 */

const ANIMATED_DIR = path.join(process.cwd(), 'media', 'animated')

export const ANIMATED_EXTENSIONS = ['mp4', 'webm'] as const

export const ANIMATED_CONTENT_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
}

/** Only ever touch simple slug-shaped names — this feeds a file route. */
export const SLUG_RE = /^[a-z0-9-]{1,64}$/

/** Absolute path of the animation for a slug, or null when none exists. */
export function animatedFileFor(slug: string): { path: string; ext: string } | null {
  if (!SLUG_RE.test(slug)) return null
  for (const ext of ANIMATED_EXTENSIONS) {
    const p = path.join(ANIMATED_DIR, `${slug}.${ext}`)
    if (existsSync(p)) return { path: p, ext }
  }
  return null
}

/** Public URL for a cuisine's animation, or null — the card falls back to its image. */
export function animatedUrlFor(slug: string): string | null {
  return animatedFileFor(slug) ? `/animated/${slug}` : null
}
