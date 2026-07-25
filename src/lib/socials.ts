/**
 * The curated set of social platforms a creator profile supports, plus pure
 * URL validation/normalisation shared by the collection, the account editor,
 * and the profile/hover-card renderers.
 */

export type SocialKey = 'instagram' | 'tiktok' | 'youtube' | 'x' | 'website'

export type SocialPlatform = { key: SocialKey; label: string; placeholder: string }

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourhandle' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourhandle' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel' },
  { key: 'x', label: 'X', placeholder: 'https://x.com/yourhandle' },
  { key: 'website', label: 'Website', placeholder: 'https://yoursite.com' },
]

export const SOCIAL_KEYS = SOCIAL_PLATFORMS.map((p) => p.key)

export type Socials = Partial<Record<SocialKey, string>>

/**
 * Normalise a user-entered link to a clean https URL, or null if empty/invalid.
 * Accepts a bare host ("instagram.com/x") by assuming https. Rejects anything
 * that isn't a plain http(s) web URL (no javascript:, mailto:, etc.).
 */
export function normalizeSocialUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null

  let candidate = v
  if (!/^https?:\/\//i.test(v)) {
    // Another scheme with "://" (ftp://…) — reject outright.
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return null
    // A scheme prefix without "//" (mailto:, javascript:, tel:) — a real host
    // has a dot before the colon (example.com:8080), a scheme name does not.
    const bareScheme = v.match(/^([a-z][a-z0-9+.-]*):/i)
    if (bareScheme && !bareScheme[1].includes('.')) return null
    candidate = `https://${v}`
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname.includes('.')) return null
  return url.toString()
}

/** Validate for form feedback: empty is OK (optional); non-empty must normalise. */
export function isValidSocial(raw: string | null | undefined): boolean {
  const v = (raw ?? '').trim()
  return v === '' || normalizeSocialUrl(v) !== null
}

/** Clean an incoming socials object → only valid, normalised entries. */
export function cleanSocials(input: Record<string, unknown> | null | undefined): Socials {
  const out: Socials = {}
  if (!input) return out
  for (const key of SOCIAL_KEYS) {
    const norm = normalizeSocialUrl(typeof input[key] === 'string' ? (input[key] as string) : null)
    if (norm) out[key] = norm
  }
  return out
}
