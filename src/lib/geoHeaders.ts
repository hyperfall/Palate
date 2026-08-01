/**
 * The viewer's country, as the edge reports it.
 *
 * Reading only Vercel's header made detection a property of one host: behind
 * Cloudflare, CloudFront or a plain reverse proxy the site silently decided
 * everyone was in the fallback country, and nothing said so.
 *
 * None of these headers exist in local development. There is no edge in front
 * of `next dev` to add them, so a VPN changes the IP and no code ever reads
 * it — location detection cannot work locally, and that is a property of the
 * environment rather than a bug to chase.
 */

/** In provider preference order; the first plausible answer wins. */
export const GEO_HEADERS = [
  'x-vercel-ip-country', // Vercel
  'cf-ipcountry', // Cloudflare
  'cloudfront-viewer-country', // AWS CloudFront
  'fastly-client-country-code', // Fastly
  'x-geo-country', // generic reverse proxies
  'x-country-code',
] as const

/**
 * Values that mean "we don't know" rather than a place.
 *
 * Cloudflare sends XX when it cannot place an IP and T1 for Tor exit nodes.
 * Passing either through as if it were a country produced a panel with no
 * retailers and no explanation — worse than falling back, because the fallback
 * at least shows shops someone can use.
 */
const UNKNOWN = new Set(['XX', 'T1', 'ZZ', 'A1', 'A2', 'O1'])

export function isCountryCode(value: string | null | undefined): boolean {
  if (!value) return false
  const code = value.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) && !UNKNOWN.has(code)
}

/**
 * First usable country across the known headers.
 *
 * Takes a getter rather than a Headers object so it can be tested without a
 * request, and used with any header container.
 */
export function countryFromHeaders(get: (name: string) => string | null | undefined): string | null {
  for (const header of GEO_HEADERS) {
    const value = get(header)
    if (isCountryCode(value)) return value!.trim().toUpperCase()
  }
  return null
}
