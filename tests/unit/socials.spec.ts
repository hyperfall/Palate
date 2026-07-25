import { describe, expect, it } from 'vitest'

import { cleanSocials, isValidSocial, normalizeSocialUrl, SOCIAL_KEYS } from '@/lib/socials'

describe('normalizeSocialUrl', () => {
  it('keeps a valid https URL', () => {
    expect(normalizeSocialUrl('https://instagram.com/chef')).toBe('https://instagram.com/chef')
  })
  it('adds https to a bare host', () => {
    expect(normalizeSocialUrl('tiktok.com/@chef')).toBe('https://tiktok.com/@chef')
  })
  it('trims whitespace', () => {
    expect(normalizeSocialUrl('  https://x.com/chef  ')).toBe('https://x.com/chef')
  })
  it('returns null for empty', () => {
    expect(normalizeSocialUrl('')).toBeNull()
    expect(normalizeSocialUrl(null)).toBeNull()
  })
  it('rejects non-web schemes', () => {
    expect(normalizeSocialUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeSocialUrl('mailto:a@b.com')).toBeNull()
  })
  it('rejects a bare word with no domain', () => {
    expect(normalizeSocialUrl('chef')).toBeNull()
  })
})

describe('isValidSocial', () => {
  it('empty is valid (optional field)', () => {
    expect(isValidSocial('')).toBe(true)
  })
  it('a bad non-empty value is invalid', () => {
    expect(isValidSocial('not a url')).toBe(false)
  })
  it('a good value is valid', () => {
    expect(isValidSocial('youtube.com/@c')).toBe(true)
  })
})

describe('cleanSocials', () => {
  it('keeps only valid, normalised keys and drops the rest', () => {
    const out = cleanSocials({ instagram: 'instagram.com/a', tiktok: '', x: 'nope', bogus: 'https://z.com' })
    expect(out).toEqual({ instagram: 'https://instagram.com/a' })
  })
  it('handles null input', () => {
    expect(cleanSocials(null)).toEqual({})
  })
  it('only considers known platform keys', () => {
    const out = cleanSocials(Object.fromEntries(SOCIAL_KEYS.map((k) => [k, `https://${k}.com/x`])))
    expect(Object.keys(out).sort()).toEqual([...SOCIAL_KEYS].sort())
  })
})
