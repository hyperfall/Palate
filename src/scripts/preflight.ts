import 'dotenv/config'

/**
 * Is this configuration safe to deploy?
 *
 * Every environment variable in this app has a deliberate, quiet fallback so
 * that development works with an almost-empty .env — Stripe stays hidden, email
 * logs to the console, analytics stays dormant. That is the right behaviour
 * locally and a trap at launch: a production deploy missing NEXT_PUBLIC_SITE_URL
 * does not fail, it silently publishes canonical URLs, OG tags, sitemap entries
 * and password-reset links pointing at http://localhost:3000. Nothing warns you.
 * You find out when a share preview 404s or Google indexes a localhost URL.
 *
 * So the check is explicit rather than magic. It does not throw at build time
 * (that would break local builds, which legitimately run on dev config) and it
 * does not throw at runtime (a live site should not go down over a bad OG tag).
 * It is a command you run before shipping:
 *
 *   npm run preflight
 *
 * BLOCKERS exit 1 — these publish something wrong or broken.
 * WARNINGS exit 0 — a feature stays switched off, which may be intended.
 */

type Check = { name: string; detail: string }
const blockers: Check[] = []
const warnings: Check[] = []
const ok: string[] = []

const val = (k: string) => (process.env[k] ?? '').trim()
const has = (k: string) => val(k).length > 0

/** Values that mean "nobody set this yet". */
const PLACEHOLDER = [
  /localhost/i,
  /yourdomain/i,
  /example\.(com|org)/i,
  /YOUR_SECRET_HERE/i,
  /127\.0\.0\.1/,
]
const isPlaceholder = (v: string) => PLACEHOLDER.some((re) => re.test(v))

// --- Things that publish something wrong if unset -------------------------

const siteUrl = val('NEXT_PUBLIC_SITE_URL')
if (!siteUrl) {
  blockers.push({
    name: 'NEXT_PUBLIC_SITE_URL',
    detail: 'Unset. Canonical URLs, OG tags, the sitemap and every emailed link fall back to http://localhost:3000.',
  })
} else if (isPlaceholder(siteUrl)) {
  blockers.push({
    name: 'NEXT_PUBLIC_SITE_URL',
    detail: `Still "${siteUrl}". Google would index localhost links and shared previews would 404.`,
  })
} else if (!/^https:\/\//.test(siteUrl)) {
  blockers.push({
    name: 'NEXT_PUBLIC_SITE_URL',
    detail: `"${siteUrl}" is not https. Cookies are set Secure in production and will not survive an http origin.`,
  })
} else ok.push(`NEXT_PUBLIC_SITE_URL — ${siteUrl}`)

const secret = val('PAYLOAD_SECRET')
if (!secret) blockers.push({ name: 'PAYLOAD_SECRET', detail: 'Unset. Payload cannot sign admin sessions.' })
else if (isPlaceholder(secret) || secret.length < 24) {
  blockers.push({
    name: 'PAYLOAD_SECRET',
    detail: 'Still the template value, or too short. Anyone who knows it can forge an admin session.',
  })
} else ok.push('PAYLOAD_SECRET — set')

const db = val('DATABASE_URL')
if (!db) blockers.push({ name: 'DATABASE_URL', detail: 'Unset. Nothing will start.' })
else if (isPlaceholder(db)) {
  blockers.push({ name: 'DATABASE_URL', detail: 'Points at a local database. Production would start empty, or not at all.' })
} else ok.push('DATABASE_URL — remote')

for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!has(k)) {
    blockers.push({
      name: k,
      detail: 'Unset. Accounts, saving, meal plans and households all depend on Supabase.',
    })
  } else ok.push(`${k} — set`)
}

// --- Things that simply stay switched off ---------------------------------

const emailFrom = val('EMAIL_FROM')
if (!has('RESEND_API_KEY')) {
  warnings.push({
    name: 'RESEND_API_KEY',
    detail: 'Unset. Creators are never told whether their recipe was approved — the verdict only reaches the server log.',
  })
} else if (!emailFrom || isPlaceholder(emailFrom)) {
  blockers.push({
    name: 'EMAIL_FROM',
    detail: `Resend is configured but From is "${emailFrom || 'unset'}". Sending 403s unless the domain is verified in Resend.`,
  })
} else if (/resend\.dev/i.test(emailFrom)) {
  blockers.push({
    name: 'EMAIL_FROM',
    detail: 'Using the Resend sandbox sender, which only ever delivers to the account owner. No creator would receive their verdict.',
  })
} else ok.push(`EMAIL_FROM — ${emailFrom}`)

const stripeBits = ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_SUPPORTER', 'STRIPE_WEBHOOK_SECRET']
const setStripe = stripeBits.filter(has)
if (setStripe.length === 0) {
  warnings.push({ name: 'Stripe', detail: 'Unset. The supporter tier stays hidden and un-buyable — fine if that is deliberate.' })
} else if (setStripe.length < stripeBits.length) {
  blockers.push({
    name: 'Stripe',
    detail: `Half-configured (${setStripe.join(', ')}). Without the webhook secret nothing writes a subscription, so people could pay and get nothing.`,
  })
} else if (/sk_test_/.test(val('STRIPE_SECRET_KEY'))) {
  blockers.push({ name: 'STRIPE_SECRET_KEY', detail: 'A test key. Real cards would be declined.' })
} else ok.push('Stripe — fully configured (live)')

if (!has('NEXT_PUBLIC_GA_ID')) {
  warnings.push({ name: 'NEXT_PUBLIC_GA_ID', detail: 'Unset. Analytics stays dormant — fine if that is deliberate.' })
} else ok.push('NEXT_PUBLIC_GA_ID — set')

if (!has('BLOB_READ_WRITE_TOKEN')) {
  warnings.push({
    name: 'BLOB_READ_WRITE_TOKEN',
    detail: 'Unset. Uploads write to local disk, which most hosts wipe on redeploy — creator photos would vanish.',
  })
} else ok.push('BLOB_READ_WRITE_TOKEN — set')

// --- Report ---------------------------------------------------------------

const line = (s: string) => console.log(s)
line('')
line('Preflight — is this configuration safe to deploy?')
line('')
if (ok.length) {
  line(`  Ready (${ok.length})`)
  for (const o of ok) line(`    ✓ ${o}`)
  line('')
}
if (warnings.length) {
  line(`  Switched off (${warnings.length}) — deploys fine, feature is simply absent`)
  for (const w of warnings) line(`    · ${w.name}: ${w.detail}`)
  line('')
}
if (blockers.length) {
  line(`  BLOCKERS (${blockers.length}) — these publish something wrong`)
  for (const b of blockers) line(`    ✗ ${b.name}: ${b.detail}`)
  line('')
  line('Not safe to deploy yet.')
  process.exit(1)
}
line('No blockers. Safe to deploy.')
line('')
process.exit(0)
