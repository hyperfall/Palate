/**
 * One source of truth for username / @handle rules, shared by the live
 * availability check (client) and the server endpoint. A username doubles as the
 * public creator handle at /creator/<handle>, so the rules lean strict and a
 * short reserved list keeps system and impersonation-prone names out.
 */

export const USERNAME_MIN = 2
export const USERNAME_MAX = 30

const RESERVED = new Set([
  'account',
  'admin',
  'administrator',
  'api',
  'app',
  'auth',
  'brand',
  'collections',
  'creator',
  'creators',
  'cuisine',
  'cuisines',
  'help',
  'me',
  'official',
  'owner',
  'palate',
  'recipe',
  'recipes',
  'root',
  'search',
  'settings',
  'staff',
  'students',
  'studio',
  'support',
  'taste-night',
  'team',
  'tonight',
  'you',
])

/** Lowercase and strip to the allowed character set — exactly what we store. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
}

export type UsernameCheck = { ok: true } | { ok: false; reason: string }

/** Format + reserved-word validation on an already-normalized username. */
export function validateUsername(name: string): UsernameCheck {
  if (name.length < USERNAME_MIN) return { ok: false, reason: `At least ${USERNAME_MIN} characters.` }
  if (name.length > USERNAME_MAX) return { ok: false, reason: `Up to ${USERNAME_MAX} characters.` }
  if (!/^[a-z0-9]/.test(name) || !/[a-z0-9]$/.test(name)) {
    return { ok: false, reason: 'Start and end with a letter or number.' }
  }
  if (!/^[a-z0-9._-]+$/.test(name)) return { ok: false, reason: 'Letters, numbers, and . _ - only.' }
  if (RESERVED.has(name)) return { ok: false, reason: 'That one’s reserved.' }
  return { ok: true }
}
