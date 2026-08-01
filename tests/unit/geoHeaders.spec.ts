import { describe, expect, it } from 'vitest'

import { countryFromHeaders, GEO_HEADERS, isCountryCode } from '@/lib/geoHeaders'

const from = (headers: Record<string, string>) =>
  countryFromHeaders((name) => headers[name] ?? null)

describe('countryFromHeaders', () => {
  it('reads the country from whichever edge is in front', () => {
    // Reading only Vercel's header meant that behind any other proxy the site
    // decided everyone lived in the fallback country.
    expect(from({ 'x-vercel-ip-country': 'DE' })).toBe('DE')
    expect(from({ 'cf-ipcountry': 'JP' })).toBe('JP')
    expect(from({ 'cloudfront-viewer-country': 'BR' })).toBe('BR')
    expect(from({ 'x-geo-country': 'NL' })).toBe('NL')
  })

  it('returns null when no edge reported anything — the local dev case', () => {
    // next dev has no edge in front of it, so a VPN changes the IP and nothing
    // ever reads it. The caller needs to know this is absence, not a country.
    expect(from({})).toBeNull()
    expect(from({ host: 'localhost:3000', 'user-agent': 'x' })).toBeNull()
  })

  it('treats "we could not place this IP" as unknown, not as a country', () => {
    // Cloudflare sends XX for unplaceable IPs and T1 for Tor. Passing either
    // through produced a panel with no shops and no explanation.
    expect(from({ 'cf-ipcountry': 'XX' })).toBeNull()
    expect(from({ 'cf-ipcountry': 'T1' })).toBeNull()
  })

  it('falls through an unknown value to the next provider', () => {
    expect(from({ 'x-vercel-ip-country': 'XX', 'cf-ipcountry': 'IE' })).toBe('IE')
  })

  it('normalises case and stray whitespace', () => {
    expect(from({ 'x-vercel-ip-country': ' de ' })).toBe('DE')
  })

  it('rejects anything that is not a two-letter code', () => {
    expect(from({ 'x-vercel-ip-country': 'GBR' })).toBeNull()
    expect(from({ 'x-vercel-ip-country': '' })).toBeNull()
    expect(from({ 'x-vercel-ip-country': '12' })).toBeNull()
  })

  it('prefers the first provider when several answer', () => {
    expect(from({ 'x-vercel-ip-country': 'FR', 'cf-ipcountry': 'DE' })).toBe('FR')
    expect(GEO_HEADERS[0]).toBe('x-vercel-ip-country')
  })
})

describe('isCountryCode', () => {
  it('accepts a real code and refuses the placeholders', () => {
    expect(isCountryCode('GB')).toBe(true)
    expect(isCountryCode('XX')).toBe(false)
    expect(isCountryCode(null)).toBe(false)
    expect(isCountryCode(undefined)).toBe(false)
  })
})
