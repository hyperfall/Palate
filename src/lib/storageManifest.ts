import type { ConsentCategory } from './consent'

/**
 * Everything this site stores on a visitor's device, declared once.
 *
 * Two things read this: the code that clears a category when consent is
 * withdrawn, and the cookie table on the privacy page. That is the point. A
 * policy maintained by hand drifts from the code within a release or two, and
 * the gap is invisible — the page keeps describing cookies that no longer
 * exist and stays silent about the ones that do.
 *
 * localStorage is in here alongside cookies deliberately. PECR and the ICO's
 * guidance are about storing or accessing information on someone's device, not
 * about the particular API used to do it, so a preference in localStorage needs
 * the same consent a preference in a cookie would.
 *
 * A test asserts that every `palate:` key used anywhere in the source appears
 * below, so adding storage without declaring it fails the build rather than
 * quietly making the policy wrong.
 */

export type StorageKind = 'cookie' | 'local'

export type StorageEntry = {
  /** The literal name, or a prefix when a third party sets several. */
  name: string
  kind: StorageKind
  /** `necessary` needs no consent; the rest are gated on their category. */
  category: ConsentCategory | 'necessary'
  /** Whose it is — us, or a third party we load. */
  party: 'Palate' | string
  purpose: string
  /** Plain-language retention, for the table. */
  retention: string
  /** True when the name is a prefix (third-party cookies with suffixes). */
  prefix?: boolean
}

export const STORAGE_MANIFEST: StorageEntry[] = [
  // ── Strictly necessary ────────────────────────────────────────────────────
  {
    name: 'palate_consent',
    kind: 'cookie',
    category: 'necessary',
    party: 'Palate',
    purpose: 'Remembers your cookie choices so we do not ask on every page.',
    retention: '6 months',
  },
  {
    name: 'sb-',
    kind: 'cookie',
    category: 'necessary',
    party: 'Supabase',
    purpose: 'Keeps you signed in. Set only after you sign in.',
    retention: 'Until you sign out',
    prefix: true,
  },
  {
    name: 'payload-token',
    kind: 'cookie',
    category: 'necessary',
    party: 'Palate',
    purpose: 'Signs in editors to the admin. Never set for ordinary visitors.',
    retention: 'Until sign-out',
  },
  {
    name: 'palate:cost-calculator',
    kind: 'local',
    category: 'necessary',
    party: 'Palate',
    purpose:
      'The costing you are working on, so a refresh does not throw it away. Without it the calculator cannot do the thing you asked it to.',
    retention: 'Until you clear it or save the costing',
  },

  // ── Preferences ───────────────────────────────────────────────────────────
  {
    name: 'palate:shop-country',
    kind: 'local',
    category: 'preferences',
    party: 'Palate',
    purpose: 'The country you picked, so shops and prices match where you are.',
    retention: 'Until you change or withdraw it',
  },
  {
    name: 'palate:units',
    kind: 'local',
    category: 'preferences',
    party: 'Palate',
    purpose: 'Whether you read recipes in metric or US measures.',
    retention: 'Until you change or withdraw it',
  },
  {
    name: 'palate:quiz-nudge',
    kind: 'local',
    category: 'preferences',
    party: 'Palate',
    purpose: 'That you dismissed the taste-quiz prompt, so it stops appearing.',
    retention: '7 days',
  },

  // ── Analytics ─────────────────────────────────────────────────────────────
  {
    name: '_ga',
    kind: 'cookie',
    category: 'analytics',
    party: 'Google Analytics',
    purpose: 'Counts visitors and which pages get read. Not set unless you allow it.',
    retention: '2 years',
    prefix: true,
  },
  {
    name: '_gid',
    kind: 'cookie',
    category: 'analytics',
    party: 'Google Analytics',
    purpose: 'Distinguishes visitors across a day.',
    retention: '24 hours',
    prefix: true,
  },
  {
    name: '_gat',
    kind: 'cookie',
    category: 'analytics',
    party: 'Google Analytics',
    purpose: 'Limits how often requests are sent.',
    retention: '1 minute',
    prefix: true,
  },

  // ── Marketing ─────────────────────────────────────────────────────────────
  {
    name: '_gcl',
    kind: 'cookie',
    category: 'marketing',
    party: 'Google',
    purpose: 'Attributes a sign-up to an ad, if we ever run one.',
    retention: '90 days',
    prefix: true,
  },
  {
    name: 'IDE',
    kind: 'cookie',
    category: 'marketing',
    party: 'Google',
    purpose: 'Measures whether an ad led anywhere. Never set unless you allow marketing.',
    retention: '13 months',
    prefix: true,
  },
  {
    name: 'test_cookie',
    kind: 'cookie',
    category: 'marketing',
    party: 'Google',
    purpose: 'Checks whether your browser accepts cookies at all before anything else is set.',
    retention: '15 minutes',
  },
]

/** Cookie name prefixes to clear when a category is withdrawn. */
export function cookiePrefixesFor(category: ConsentCategory): string[] {
  return STORAGE_MANIFEST.filter((e) => e.kind === 'cookie' && e.category === category).map(
    (e) => e.name,
  )
}

/**
 * localStorage keys to clear when a category is withdrawn.
 *
 * The reason this function has to exist: the Preferences toggle used to clear
 * nothing at all, because every preference this site keeps lives in
 * localStorage and the clearing code only looked at cookies. Someone could
 * switch Preferences off and watch their country and units survive it.
 */
export function localKeysFor(category: ConsentCategory): string[] {
  return STORAGE_MANIFEST.filter((e) => e.kind === 'local' && e.category === category).map(
    (e) => e.name,
  )
}

/** Everything, grouped for the policy table. */
export function manifestByCategory(): Array<{
  category: ConsentCategory | 'necessary'
  entries: StorageEntry[]
}> {
  const order: Array<ConsentCategory | 'necessary'> = [
    'necessary',
    'preferences',
    'analytics',
    'marketing',
  ]
  return order
    .map((category) => ({
      category,
      entries: STORAGE_MANIFEST.filter((e) => e.category === category),
    }))
    .filter((g) => g.entries.length > 0)
}
