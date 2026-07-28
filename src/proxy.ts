import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const VISITOR_COOKIE = 'palate_rotation'

/**
 * Issues the opaque rotation key that `selectBrandCards` uses to give every
 * brand fair, evenly-spread exposure (design spec §6 step 3).
 *
 * Privacy: this is a random value with no personal data in it — not derived
 * from IP, user agent, or anything about the visitor. It exists solely so the
 * weighted round-robin is stable for one person across pages instead of
 * re-rolling on every render (which clumps). Nothing reads it but the rotation.
 */
/**
 * Per-request Content-Security-Policy with a nonce. Locks scripts to our own
 * nonce'd tags (Next propagates the nonce to its scripts automatically) so an
 * injected inline script can't run — the main XSS defence. Sourced for what the
 * app actually loads: Supabase (REST + realtime websocket), Google Analytics,
 * the video-embed providers, and same-origin/blob/https images. The Payload
 * admin + API are excluded by the matcher below, so its inline assets are never
 * constrained. In dev we allow eval for HMR; prod uses strict-dynamic.
 */
function buildCsp(nonce: string): string {
  const isProd = process.env.NODE_ENV === 'production'

  let supaHttp = ''
  let supaWss = ''
  try {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (raw) {
      const origin = new URL(raw).origin
      supaHttp = origin
      supaWss = origin.replace(/^https/, 'wss')
    }
  } catch {
    /* unset/invalid → no supabase sources, app degrades anyway */
  }

  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'self'`,
    `form-action 'self'`,
    // nonce → Next's own scripts; the sha256 is our static theme-boot script
    // (hashed, not nonced, so server/client HTML match — no hydration mismatch).
    `script-src 'self' 'nonce-${nonce}' 'sha256-SPCKtJb7vbkE0oGUlUkbSW9lKlfV2+hrafPs14RM2sA=' ${isProd ? "'strict-dynamic' https:" : "'unsafe-eval'"}`,
    // Next + Tailwind inject inline <style>; nonces aren't propagated to styles.
    `style-src 'self' 'unsafe-inline'`,
    // Recipe/creator photos (Blob + /media), avatars, markdown + social images.
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' ${supaHttp} ${supaWss} https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com`.replace(/\s+/g, ' ').trim(),
    // Creator video embeds (VideoEmbed allow-lists these providers).
    `frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://www.tiktok.com`,
    `media-src 'self' https: blob:`,
    // Report violations (Reporting-API group + legacy fallback) so a mis-sourced
    // directive surfaces in the logs rather than silently breaking in prod.
    `report-to csp`,
    `report-uri /csp-report`,
    ...(isProd ? ['upgrade-insecure-requests'] : []),
  ]
  return directives.join('; ')
}

export async function proxy(request: NextRequest) {
  // A fresh nonce per response; Next reads it off the request CSP header and
  // stamps it onto its own scripts.
  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  // Names the 'csp' report-to group used by the CSP above.
  response.headers.set('Reporting-Endpoints', 'csp="/csp-report"')

  if (!request.cookies.get(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 90,
    })
  }

  // Supabase session refresh: expired auth cookies are renewed here so the
  // saved-recipes UI never sees a stale session. No-op until the env is set.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          for (const { name, value, options } of cookies) {
            response.cookies.set(name, value, options)
          }
        },
      },
    })
    // Never fatal. This middleware matches every page route, so an unreachable
    // Supabase (outage, DNS, timeout — not just missing env) would otherwise
    // throw here and take the whole site down with it. A failed refresh costs
    // the reader a stale session; a throw costs them the page. Every other
    // call site in the codebase guards this same call.
    await supabase.auth.getUser().catch(() => null)
  }

  return response
}

export const config = {
  // Public pages only — the admin panel and API have no brand slots to rotate.
  matcher: ['/((?!admin|api|csp-report|_next/static|_next/image|favicon.ico).*)'],
}
