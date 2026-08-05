/**
 * Cookie-consent state, persisted in a first-party cookie so both the client and
 * the server can read the decision. Strictly-necessary cookies (Supabase auth,
 * this consent cookie itself) are exempt and never gated. Everything else is
 * opt-in by default — the GDPR/UK/LGPD-safe stance, applied everywhere.
 *
 * Bumping CONSENT_VERSION invalidates stored decisions and re-prompts — do it
 * whenever the categories or the processors behind them change.
 */

import { cookiePrefixesFor, localKeysFor } from './storageManifest'

export const CONSENT_COOKIE = 'palate_consent'
export const CONSENT_VERSION = 1
export const CONSENT_MAX_AGE_DAYS = 180

export type ConsentCategory = 'analytics' | 'marketing' | 'preferences'

export const CATEGORIES: {
  key: ConsentCategory
  label: string
  description: string
}[] = [
  {
    key: 'analytics',
    label: 'Analytics',
    description:
      'Anonymous usage measurement (Google Analytics) so we can see which recipes and pages work: how many visitors, what they view. Never sold, never used to identify you.',
  },
  {
    key: 'marketing',
    label: 'Marketing',
    description:
      'Cookies that measure and personalise advertising (e.g. Google Ads). Off unless you turn them on; controls the “sale/share” of data under US privacy law.',
  },
  {
    key: 'preferences',
    label: 'Preferences',
    description:
      'Remembers non-essential choices to tailor the experience. (Your theme choice is stored as a strictly-necessary preference and is exempt.)',
  },
]

export type ConsentState = {
  version: number
  /** ISO timestamp of the decision — your proof-of-consent record. */
  updatedAt: string
  analytics: boolean
  marketing: boolean
  preferences: boolean
}

export const DENIED: Omit<ConsentState, 'version' | 'updatedAt'> = {
  analytics: false,
  marketing: false,
  preferences: false,
}

export function makeConsent(choices: Partial<Record<ConsentCategory, boolean>>): ConsentState {
  return {
    version: CONSENT_VERSION,
    updatedAt: new Date().toISOString(),
    analytics: Boolean(choices.analytics),
    marketing: Boolean(choices.marketing),
    preferences: Boolean(choices.preferences),
  }
}

/** Parse the consent cookie. Null when absent, malformed, or a stale version. */
export function parseConsent(raw: string | undefined | null): ConsentState | null {
  if (!raw) return null
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentState>
    if (data.version !== CONSENT_VERSION) return null
    return {
      version: CONSENT_VERSION,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
      analytics: Boolean(data.analytics),
      marketing: Boolean(data.marketing),
      preferences: Boolean(data.preferences),
    }
  } catch {
    return null
  }
}

export function readConsentCookie(): ConsentState | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
  return parseConsent(match?.split('=').slice(1).join('='))
}

export function writeConsentCookie(state: ConsentState): void {
  if (typeof document === 'undefined') return
  const value = encodeURIComponent(JSON.stringify(state))
  const maxAge = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60
  // Secure wherever the page is: a record of someone's privacy choices should
  // not be the one cookie willing to travel in clear. Omitted on http so it
  // still works on localhost.
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`
}

/**
 * Global Privacy Control — a browser/legal opt-out signal (CCPA/CPRA). When set,
 * we treat marketing and analytics as denied until the visitor explicitly says
 * otherwise, and reflect that in the banner.
 */
export function hasGPC(): boolean {
  if (typeof navigator === 'undefined') return false
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
}

/**
 * Clear everything a category covers — cookies AND localStorage.
 *
 * The localStorage half is the bug this replaces. Every preference this site
 * keeps lives in localStorage, and the old version only cleared cookies with a
 * hardcoded list in which `preferences` was an empty array. Switching
 * Preferences off therefore did nothing at all: the country, the units and the
 * dismissed prompt all survived a withdrawal that claimed to remove them.
 *
 * PECR is about storing information on someone's device, not about which API
 * put it there.
 */
export function clearCategoryStorage(category: ConsentCategory): void {
  clearCookiesByPrefix(cookiePrefixesFor(category))
  if (typeof window === 'undefined') return
  for (const key of localKeysFor(category)) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* storage unavailable — nothing was stored to begin with */
    }
  }
}

export function clearCookiesByPrefix(prefixes: string[]): void {
  if (typeof document === 'undefined' || prefixes.length === 0) return
  const host = location.hostname
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`]
  for (const cookie of document.cookie.split('; ')) {
    const name = cookie.split('=')[0]
    if (!prefixes.some((p) => name.startsWith(p))) continue
    for (const domain of domains) {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT${domain ? `; domain=${domain}` : ''}`
    }
  }
}
