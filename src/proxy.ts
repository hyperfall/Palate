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
 * Content-Security-Policy for a statically-rendered site.
 *
 * This used to issue a per-request nonce and pair it with 'strict-dynamic',
 * which is the stronger policy and the one every guide recommends — and it
 * silently broke almost the whole site. A nonce has to differ on every
 * response, so it cannot be baked into HTML that was rendered once at build
 * time and served from the cache. Next omits it there, leaving prerendered
 * pages with no nonce on any script; 'strict-dynamic' then ignores 'self' and
 * blocks all of them. React's hydration payload never ran, so every cached
 * page rendered as a static picture of itself: no menu, no theme toggle, no
 * client navigation, and any page waiting on a Suspense boundary sat on its
 * loading skeleton forever. Dynamic routes were fine, which is exactly why it
 * was easy to miss — /recipes worked while /about was inert.
 *
 * So the choice is nonce-based CSP *or* static rendering, not both. This site
 * is static-first, so the nonce goes. 'unsafe-inline' is the cost, and it is a
 * real one: it is what a nonce exists to avoid. Note that it cannot be hedged
 * — a nonce or hash anywhere in script-src makes browsers ignore
 * 'unsafe-inline' entirely, which is why the theme-boot script's sha256 is
 * gone too. Everything that does not depend on per-request state still holds
 * the line: scripts only from this origin and the analytics host, no plugins,
 * no framing, forms and <base> pinned to self.
 *
 * Sourced for what the app actually loads: Supabase (REST + realtime
 * websocket), Google Analytics, the video-embed providers, and
 * same-origin/blob/https images. The Payload admin + API are excluded by the
 * matcher below, so its inline assets are never constrained.
 */
export function buildCsp(): string {
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
    // 'unsafe-inline' covers React's hydration and streaming scripts and our
    // theme-boot script; the analytics host is named because without
    // 'strict-dynamic' it is no longer implied. Dev also needs eval for HMR.
    `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com${isProd ? '' : " 'unsafe-eval'"}`,
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
  const csp = buildCsp()

  // The CSP is deliberately NOT set on the request headers. That is the hook
  // Next uses to detect a nonce and stamp it onto its scripts, and doing so
  // opts the route out of static rendering — the very combination that broke
  // hydration on every cached page.
  const response = NextResponse.next()
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
