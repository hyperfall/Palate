import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A page that calls notFound() must not sit under a loading.tsx.
 *
 * This guards a bug that is completely invisible in a browser. A `loading.tsx`
 * anywhere above a page creates a Suspense boundary, so Next flushes the shell
 * to the client before the page component finishes — and once bytes are on the
 * wire the status is committed as 200. A later notFound() can then only swap
 * the body. The visitor sees a correct-looking not-found page; the response
 * says "200 OK". That is a soft 404, and search engines index them as real
 * pages, which is how an unknown URL ends up in results.
 *
 * Nothing surfaces this. The page looks right, the tests pass, and only a
 * `curl -I` tells the truth. It had already happened on four separate routes
 * here, and the recipe page hid it twice over — it was the one route with a
 * loading.tsx at BOTH its own segment and its parent, so removing either one
 * alone left the status unchanged and made the fix look ineffective.
 *
 * So this is a filesystem test rather than an HTTP one: it needs no server, no
 * build and no database, which means it runs on every commit rather than only
 * when someone thinks to check.
 */

const APP_DIR = join(process.cwd(), 'src', 'app')

/** Route-group and private folders don't add a URL segment, but they do still
 *  nest — a loading.tsx inside one covers everything below it either way. */
function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (entry === 'page.tsx') out.push(full)
  }
  return out
}

/** Every directory from the app root down to (and including) the page's own. */
function segmentsAbove(pageFile: string): string[] {
  const parts = relative(APP_DIR, pageFile).split(sep)
  parts.pop() // drop 'page.tsx'
  const dirs: string[] = []
  let current = APP_DIR
  dirs.push(current)
  for (const part of parts) {
    current = join(current, part)
    dirs.push(current)
  }
  return dirs
}

describe('soft 404s', () => {
  const pages = walk(APP_DIR)

  it('finds the app router pages to check', () => {
    // If a refactor moves the app directory this test would otherwise pass by
    // checking nothing at all.
    expect(pages.length).toBeGreaterThan(5)
  })

  it('no page that calls notFound() has a loading.tsx above it', () => {
    const offenders: string[] = []

    for (const page of pages) {
      const source = readFileSync(page, 'utf8')
      // The import alone isn't enough — a file can import it and not call it.
      if (!/\bnotFound\(\)/.test(source)) continue

      for (const dir of segmentsAbove(page)) {
        let hasLoading = false
        try {
          hasLoading = readdirSync(dir).includes('loading.tsx')
        } catch {
          hasLoading = false
        }
        if (hasLoading) {
          offenders.push(
            `${relative(process.cwd(), page)} — shell flushed by ${relative(process.cwd(), join(dir, 'loading.tsx'))}`,
          )
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
