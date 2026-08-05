import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { cookiePrefixesFor, localKeysFor, STORAGE_MANIFEST } from '@/lib/storageManifest'

/**
 * The cookie policy is generated from the manifest, so the manifest has to be
 * complete.
 *
 * A hand-maintained policy drifts from the code within a release or two, and
 * the drift is invisible: the page goes on describing storage that no longer
 * exists and stays silent about storage that does. Nobody notices, because
 * nobody reads a cookie policy looking for omissions — which is exactly why
 * the omission is worth a test.
 *
 * This walks the source for storage keys and fails if one is missing from the
 * manifest. Adding storage without declaring it is then a failing build rather
 * than a quietly untrue privacy page.
 */

const SRC = join(process.cwd(), 'src')

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

const files = sourceFiles(SRC).filter((f) => !f.endsWith('storageManifest.ts'))
const corpus = files.map((f) => readFileSync(f, 'utf8')).join('\n')

describe('the storage manifest', () => {
  it('declares every palate: key the code actually stores', () => {
    // Only our own keys — a third party's cookies are declared by name in the
    // manifest and cannot be discovered this way.
    const used = new Set(
      [...corpus.matchAll(/'(palate:[a-z0-9-]+)'/g)].map((m) => m[1]),
      // Event-channel names are broadcast, not stored. They end in -change and
      // never reach localStorage.
    )
    const declared = new Set(STORAGE_MANIFEST.map((e) => e.name))
    const missing = [...used].filter((k) => !k.endsWith('-change') && !declared.has(k))
    expect(missing).toEqual([])
  })

  it('does not describe storage that no longer exists', () => {
    const ours = STORAGE_MANIFEST.filter((e) => e.name.startsWith('palate:'))
    const stale = ours.filter((e) => !corpus.includes(`'${e.name}'`))
    expect(stale.map((e) => e.name)).toEqual([])
  })

  it('gives every entry a purpose and a retention a reader can act on', () => {
    for (const entry of STORAGE_MANIFEST) {
      expect(entry.purpose.length, `${entry.name} purpose`).toBeGreaterThan(15)
      expect(entry.retention.length, `${entry.name} retention`).toBeGreaterThan(2)
      expect(entry.party.length, `${entry.name} party`).toBeGreaterThan(0)
    }
  })
})

describe('withdrawing a category', () => {
  it('clears the preferences that live in localStorage', () => {
    // The bug this replaces: every preference here is localStorage, and the
    // old clearing code only looked at cookies with `preferences: []`. The
    // toggle removed nothing and said it had.
    const keys = localKeysFor('preferences')
    expect(keys).toContain('palate:shop-country')
    expect(keys).toContain('palate:units')
    expect(keys.length).toBeGreaterThan(0)
  })

  it('clears the analytics and marketing cookies', () => {
    expect(cookiePrefixesFor('analytics')).toEqual(expect.arrayContaining(['_ga', '_gid']))
    expect(cookiePrefixesFor('marketing')).toEqual(expect.arrayContaining(['_gcl']))
  })

  it('never offers to clear anything strictly necessary', () => {
    // Sign-in and the consent record itself are not a category anyone can
    // withdraw — withdrawing the consent cookie would forget the withdrawal.
    for (const category of ['analytics', 'marketing', 'preferences'] as const) {
      const names = [...cookiePrefixesFor(category), ...localKeysFor(category)]
      expect(names).not.toContain('palate_consent')
      expect(names).not.toContain('sb-')
      expect(names).not.toContain('payload-token')
      expect(names).not.toContain('palate:cost-calculator')
    }
  })

  it('keeps the work in progress, which is not a preference', () => {
    // The costing you are mid-way through is the service you asked for, not a
    // convenience — losing it to a consent toggle would be its own bug.
    const entry = STORAGE_MANIFEST.find((e) => e.name === 'palate:cost-calculator')
    expect(entry?.category).toBe('necessary')
  })
})
