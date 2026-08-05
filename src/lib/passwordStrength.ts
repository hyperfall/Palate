/**
 * Lightweight password strength estimate for the sign-up form. Deliberately not
 * zxcvbn (≈400KB in the client bundle) — a length + character-variety heuristic
 * with a common-password blocklist covers the real cases: it blocks "password1"
 * and "12345678", rewards longer passphrases, and nudges toward variety. The
 * authoritative check is server-side (Supabase min-length + leaked-password
 * protection); this is fast, honest UX feedback.
 */

export type StrengthResult = {
  score: 0 | 1 | 2 | 3 | 4 // very weak → strong
  label: string
  suggestions: string[]
  /** Min bar for a NEW password. */
  acceptable: boolean
}

// A small blocklist of the most-abused passwords + obvious patterns.
const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty', 'qwertyui', 'qwerty123', 'letmein', 'welcome', 'admin', 'iloveyou',
  'abc123', 'monkey', 'dragon', 'football', 'baseball', 'sunshine', 'princess',
  'passw0rd', 'trustno1', 'whatever', 'starwars', 'changeme', 'secret',
])

const classCount = (pw: string): number => {
  let c = 0
  if (/[a-z]/.test(pw)) c++
  if (/[A-Z]/.test(pw)) c++
  if (/[0-9]/.test(pw)) c++
  if (/[^a-zA-Z0-9]/.test(pw)) c++
  return c
}

const isSequential = (pw: string): boolean => {
  const s = pw.toLowerCase()
  if (/^(.)\1+$/.test(s)) return true // all same char
  const seqs = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiop']
  return seqs.some((seq) => seq.includes(s) || seq.split('').reverse().join('').includes(s))
}

const LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'] as const

export function scorePassword(pw: string, ctx: { email?: string; name?: string } = {}): StrengthResult {
  const suggestions: string[] = []
  if (!pw) return { score: 0, label: 'Very weak', suggestions: ['Choose a password.'], acceptable: false }

  if (pw.length < 8) {
    return { score: 0, label: 'Too short', suggestions: ['Use at least 8 characters.'], acceptable: false }
  }

  const lower = pw.toLowerCase()
  const cls = classCount(pw)

  // Hard fails — regardless of length.
  if (COMMON.has(lower) || isSequential(pw)) {
    return { score: 0, label: 'Too common', suggestions: ['That’s a commonly-used password. Pick something unique.'], acceptable: false }
  }

  let raw = 0
  if (pw.length >= 8) raw++
  if (pw.length >= 12) raw++
  if (pw.length >= 16) raw++
  if (cls >= 2) raw++
  if (cls >= 3) raw++

  // Personal-info penalty: don't let the password contain the email or name.
  const localPart = (ctx.email ?? '').split('@')[0]?.toLowerCase()
  if (localPart && localPart.length >= 3 && lower.includes(localPart)) {
    raw = Math.min(raw, 1)
    suggestions.push('Don’t base it on your email address.')
  }
  const nm = (ctx.name ?? '').trim().toLowerCase()
  if (nm && nm.length >= 3 && lower.includes(nm)) {
    raw = Math.min(raw, 1)
    suggestions.push('Don’t base it on your name.')
  }

  if (pw.length < 12) suggestions.push('Longer is stronger: aim for 12+ characters.')
  if (cls < 3) suggestions.push('Mix upper/lowercase, numbers, and a symbol.')

  const score = Math.max(0, Math.min(4, raw - 1)) as StrengthResult['score']
  return { score, label: LABELS[score], suggestions, acceptable: score >= 2 }
}
