import { RETAILERS } from '../seed/groceryRetailerData'
import { searchUrl } from '../lib/grocery'

/**
 * Grade every seed retailer's search template against the live site.
 *
 * The registry is authored (partly AI-generated), and retailer search paths
 * are exactly where confident hallucination and link rot both bite. So the
 * rule is: nothing ships unverified. Each template is fetched with a real
 * query and classified:
 *
 *   PASS         2xx after redirects — the search page exists.
 *   BOT-BLOCKED  403/405/429 — reachable, refusing automation. Fine for a
 *                human in a browser; listed so a human can spot-check.
 *   FAIL         404, 5xx, DNS failure, timeout — fix or drop before seeding.
 *
 * Exits 1 on any FAIL so it can gate CI or a monthly cron.
 *
 *   npm run verify:grocery
 */

const QUERY = 'olive oil'
const TIMEOUT_MS = 12_000
// A plain fetch UA gets insta-blocked far more often than a browser string,
// which would misclassify working retailers as broken.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

type Grade = 'PASS' | 'BOT-BLOCKED' | 'FAIL'
type Result = { label: string; countries: string; grade: Grade; detail: string }

async function grade(url: string): Promise<{ grade: Grade; detail: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: 'text/html' },
    })
    if (res.ok) return { grade: 'PASS', detail: String(res.status) }
    if ([403, 405, 429].includes(res.status)) return { grade: 'BOT-BLOCKED', detail: String(res.status) }
    return { grade: 'FAIL', detail: String(res.status) }
  } catch (err) {
    const name = err instanceof Error ? err.name : 'error'
    return { grade: 'FAIL', detail: name === 'AbortError' ? 'timeout' : name }
  } finally {
    clearTimeout(timer)
  }
}

// Modest parallelism: fast enough for ~70 rows, polite enough not to look
// like a scraper to anyone's rate limiter.
const CONCURRENCY = 6
const results: Result[] = []
const queue = [...RETAILERS]

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      // searchUrl only reads the template fields; the seed rows carry neither
      // an id nor Payload's {code} country shape, so shim both.
      const { grade: g, detail } = await grade(
        searchUrl({ ...r, id: r.slug, countries: r.countries.map((code) => ({ code })) }, QUERY),
      )
      results.push({ label: r.label, countries: r.countries.join(','), grade: g, detail })
    }
  }),
)

const by = (g: Grade) => results.filter((r) => r.grade === g)
for (const g of ['FAIL', 'BOT-BLOCKED', 'PASS'] as const) {
  const rows = by(g)
  if (rows.length === 0) continue
  console.log(`\n${g} (${rows.length})`)
  for (const r of rows.sort((a, b) => a.countries.localeCompare(b.countries))) {
    console.log(`  ${r.countries.padEnd(6)} ${r.label.padEnd(24)} ${r.detail}`)
  }
}
console.log(
  `\n${results.length} checked: ${by('PASS').length} pass, ${by('BOT-BLOCKED').length} bot-blocked, ${by('FAIL').length} fail`,
)
process.exit(by('FAIL').length > 0 ? 1 : 0)
