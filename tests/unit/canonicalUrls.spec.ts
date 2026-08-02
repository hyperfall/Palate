import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Every page either declares a canonical URL or asks not to be indexed.
 *
 * Those are the only two honest states. A page with neither is reachable at
 * more addresses than it looks — with and without a trailing slash, behind
 * whatever tracking parameters a shared link picks up, and at both apex and
 * www — and a search engine treats each as a separate URL competing with the
 * others to rank for the same content. Fourteen public pages were in that
 * state, including the home page.
 *
 * The rule is deliberately either/or rather than "must have a canonical",
 * because a private page (the planner, an account, a share link) should not
 * carry one at all; it should be telling crawlers to stay away instead. Both
 * answers pass. Only silence fails.
 */

const APP_DIR = join(process.cwd(), 'src', 'app', '(frontend)')

/** The catch-all that renders the 404 itself — it is the not-found page, so it
 *  neither ranks nor needs an address of its own. */
const EXEMPT = new Set(['[...notFound]'])

function pageFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...pageFiles(full))
    else if (entry === 'page.tsx') out.push(full)
  }
  return out
}

describe('canonical URLs', () => {
  const pages = pageFiles(APP_DIR).filter(
    (p) => !relative(APP_DIR, p).split(sep).some((seg) => EXEMPT.has(seg)),
  )

  it('finds the pages to check', () => {
    expect(pages.length).toBeGreaterThan(15)
  })

  it('every page sets a canonical or opts out of the index', () => {
    const silent: string[] = []

    for (const page of pages) {
      const source = readFileSync(page, 'utf8')
      const hasCanonical = /alternates:\s*\{[^}]*canonical/s.test(source)
      // Either shape: a literal noindex, or robots.index set false.
      const optsOut = /robots:\s*\{[^}]*index:\s*false/s.test(source) || /noindex/.test(source)
      if (!hasCanonical && !optsOut) silent.push(relative(process.cwd(), page))
    }

    expect(silent).toEqual([])
  })
})
