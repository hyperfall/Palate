import { describe, expect, it } from 'vitest'

import { scorePassword } from '@/lib/passwordStrength'

describe('scorePassword', () => {
  it('rejects too-short passwords', () => {
    const r = scorePassword('abc123')
    expect(r.acceptable).toBe(false)
    expect(r.label).toBe('Too short')
  })

  it('blocks common passwords even if long enough', () => {
    for (const p of ['password', 'password1', '12345678', 'qwerty123', 'letmein']) {
      const r = scorePassword(p)
      expect(r.acceptable, p).toBe(false)
      expect(r.score, p).toBe(0)
    }
  })

  it('blocks sequential / repeated strings', () => {
    expect(scorePassword('aaaaaaaa').acceptable).toBe(false)
    expect(scorePassword('abcdefgh').acceptable).toBe(false)
  })

  it('rates a decent mixed password as at least fair', () => {
    const r = scorePassword('Tomato7pan')
    expect(r.acceptable).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(2)
  })

  it('rates a long varied passphrase as strong', () => {
    const r = scorePassword('Rusty-Skillet-42-Onions!')
    expect(r.score).toBe(4)
    expect(r.label).toBe('Strong')
  })

  it('penalises passwords built from the email', () => {
    const r = scorePassword('chefrahul99', { email: 'chefrahul@example.com' })
    expect(r.score).toBeLessThanOrEqual(1)
    expect(r.suggestions.join(' ')).toMatch(/email/i)
  })

  it('penalises passwords built from the name', () => {
    const r = scorePassword('rahulcooks1', { name: 'Rahul' })
    expect(r.score).toBeLessThanOrEqual(1)
  })

  it('longer scores higher than shorter for the same variety', () => {
    const short = scorePassword('Ab3$xy9z') // 8
    const long = scorePassword('Ab3$xy9zAb3$xy9z') // 16
    expect(long.score).toBeGreaterThan(short.score)
  })
})
