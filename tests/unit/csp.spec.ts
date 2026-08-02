import { describe, expect, it } from 'vitest'

import { buildCsp } from '@/proxy'

/**
 * The CSP must stay compatible with static rendering.
 *
 * This guards a failure with no symptom a developer would notice locally. The
 * policy used to issue a per-request nonce with 'strict-dynamic' — the stronger
 * shape, and the one every guide recommends. But a nonce differs on every
 * response, so it cannot be baked into HTML rendered once at build time and
 * served from the cache. Next omits it there, 'strict-dynamic' ignores 'self',
 * and every inline script on a prerendered page is blocked.
 *
 * What that looked like: pages still rendered, because the server HTML is fine.
 * They simply never hydrated. No menu, no theme toggle, no client navigation,
 * and any page waiting on a Suspense boundary sat on its loading skeleton
 * forever. Nothing appeared in the console, the build passed, and dynamically
 * rendered routes worked normally — so /recipes looked healthy while /about was
 * an inert photograph of itself.
 *
 * The subtle part, and the reason this is a test rather than a comment: a nonce
 * or hash ANYWHERE in script-src makes browsers ignore 'unsafe-inline'
 * entirely. Re-adding a hash for one small inline script — an easy, apparently
 * safe thing to do — silently reinstates the whole outage.
 */

const scriptSrc = (csp: string) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('script-src')) ?? ''

describe('content security policy', () => {
  it('allows inline scripts, which prerendered pages depend on', () => {
    expect(scriptSrc(buildCsp())).toContain("'unsafe-inline'")
  })

  it('carries no nonce or hash, which would cancel unsafe-inline', () => {
    const directive = scriptSrc(buildCsp())
    expect(directive).not.toMatch(/'nonce-/)
    expect(directive).not.toMatch(/'sha(256|384|512)-/)
  })

  it("does not use 'strict-dynamic', which ignores 'self' on static pages", () => {
    expect(scriptSrc(buildCsp())).not.toContain("'strict-dynamic'")
  })

  it('still names the analytics host explicitly', () => {
    // Without 'strict-dynamic' nothing is implied — an allowed script has to be
    // listed, or analytics silently stops loading.
    expect(scriptSrc(buildCsp())).toContain('https://www.googletagmanager.com')
  })

  it('keeps the protections that do not depend on per-request state', () => {
    const csp = buildCsp()
    for (const directive of [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
    ]) {
      expect(csp).toContain(directive)
    }
  })
})
