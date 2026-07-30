import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

import { RETAILERS } from '../seed/groceryRetailerData'

/**
 * Fetch each retailer's own icon once and store it in public/shops.
 *
 * Self-hosted on purpose. Displaying a shop's logo to identify that shop is
 * ordinary nominative use — the same thing every comparison site does — but
 * *hotlinking* it would put a third-party request on every plan page (leaking
 * readers to a dozen retailer CDNs) and would break the day anyone reorganises
 * their assets. Fetched here, normalised to a 96px PNG, served from our own
 * origin: one request to us, no leak, no rot between runs.
 *
 * Icons are taken from each retailer's published favicon/touch-icon paths — the
 * files browsers already request. Anything that can't be fetched falls back to
 * the monogram tile, which stays in the UI for exactly that reason.
 *
 *   npm run fetch:logos
 */

const OUT = path.join(process.cwd(), 'public', 'shops')
const SIZE = 96
const TIMEOUT_MS = 12_000
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

/** Icon paths in descending order of likely quality. */
const CANDIDATES = [
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/apple-touch-icon-180x180.png',
  '/favicon-192x192.png',
  '/android-chrome-192x192.png',
  '/favicon-96x96.png',
  '/favicon.svg',
  '/favicon.ico',
]

const origin = (template: string): string | null => {
  try {
    return new URL(template.replace('{query}', 'x')).origin
  } catch {
    return null
  }
}

/**
 * Ask the site where its icon is, rather than guessing paths. REWE publishes
 * /icons/favicon-48.png, which no reasonable guess list would contain; several
 * others inline the icon as a data: URI, even on their bot-block page.
 */
async function declaredIcons(base: string): Promise<string[]> {
  const html = await getText(base)
  if (!html) return []
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0])
  const scored: Array<{ href: string; size: number }> = []
  for (const tag of links) {
    if (!/rel\s*=\s*["'][^"']*icon/i.test(tag)) continue
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1]
    if (!href) continue
    // "180x180" → 180; unsized icons rank below sized ones but above nothing.
    const size = Number(tag.match(/sizes\s*=\s*["'](\d+)/i)?.[1] ?? 1)
    scored.push({ href, size })
  }
  return scored
    .sort((a, b) => b.size - a.size)
    .map((x) => {
      if (x.href.startsWith('data:')) return x.href
      try {
        return new URL(x.href, base).href
      } catch {
        return ''
      }
    })
    .filter(Boolean)
}

async function getText(url: string): Promise<string | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: 'text/html' },
    })
    // Even a 403 body is worth reading: some bot-block pages still declare the
    // brand's icon.
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Decode a data: URI image. */
function fromDataUri(uri: string): Buffer | null {
  const m = uri.match(/^data:image\/[\w.+-]+;base64,(.+)$/i)
  if (!m) return null
  try {
    return Buffer.from(m[1], 'base64')
  } catch {
    return null
  }
}

async function get(url: string): Promise<Buffer | null> {
  if (url.startsWith('data:')) return fromDataUri(url)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: 'image/*' },
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    // A 404 page served as HTML with a 200 is common; reject non-images.
    if (buf.length < 100) return null
    const type = res.headers.get('content-type') ?? ''
    if (type.includes('text/html')) return null
    return buf
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Normalise to a square PNG on a white ground. Most retailer icons assume a
 * light background; flattening avoids a dark-mode tile showing black-on-black.
 */
async function normalise(buf: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buf, { animated: false })
      .resize(SIZE, SIZE, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer()
  } catch {
    return null
  }
}

await mkdir(OUT, { recursive: true })

const found: string[] = []
const missing: string[] = []
const queue = [...RETAILERS]
const CONCURRENCY = 6

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const base = origin(r.searchUrlTemplate)
      if (!base) {
        missing.push(`${r.slug} (bad url)`)
        continue
      }
      let saved = false
      const declared = await declaredIcons(base)
      const attempts = [...declared, ...CANDIDATES.map((c) => base + c)]
      for (const candidate of attempts) {
        const raw = await get(candidate)
        if (!raw) continue
        const png = await normalise(raw)
        if (!png) continue
        await writeFile(path.join(OUT, `${r.slug}.png`), png)
        found.push(r.slug)
        saved = true
        break
      }
      if (!saved) missing.push(r.slug)
    }
  }),
)

// A generated manifest, because the client can't stat the filesystem: the tile
// needs to know whether to render an image or the monogram BEFORE it paints,
// or every missing logo flashes a broken image first.
const manifest = `// Generated by \`npm run fetch:logos\` — do not edit by hand.
//
// Which retailers have a self-hosted logo in public/shops. Everything else
// falls back to the monogram tile.
export const SHOP_LOGOS = new Set<string>([
${found
  .sort()
  .map((s) => `  '${s}',`)
  .join('\n')}
])
`
await writeFile(path.join(process.cwd(), 'src', 'lib', 'shopLogos.ts'), manifest)

console.log(`\nlogos: ${found.length} fetched, ${missing.length} without one`)
if (missing.length > 0) console.log(`no icon (monogram fallback): ${missing.sort().join(', ')}`)
process.exit(0)
