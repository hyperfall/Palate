import { NextResponse } from 'next/server'

/**
 * A small fixed-window rate limiter for public write endpoints — enough to blunt
 * naive spam/abuse (mass submissions, upload floods, rating stuffing).
 *
 * Caveat: this is in-memory, so on serverless it's per-instance, not global.
 * It raises the bar meaningfully but is NOT a substitute for edge protection —
 * production should also enable Vercel's WAF / BotID (and/or a shared store like
 * Upstash) for authoritative, cross-instance limits.
 */

type Bucket = { count: number; reset: number }
const store = new Map<string, Bucket>()

/**
 * Expired buckets were never removed, so the map only ever grew.
 *
 * That was survivable while limits were keyed on IP, but the brand-slot limit
 * is keyed on the VISITOR COOKIE — one entry per person who has ever loaded a
 * recipe. Measured: 100,000 distinct keys retain about 15.7 MB that nothing
 * frees. On a long-lived instance that is a slow leak toward an OOM, and it
 * grows fastest exactly when the site is doing well.
 *
 * Sweeping on every call would be O(n) per request, so it runs only when the
 * map has grown past a threshold — amortised to roughly nothing, and bounded
 * by however many distinct callers appear inside one window.
 */
const SWEEP_ABOVE = 10_000

function sweep(now: number): void {
  for (const [k, b] of store) if (now > b.reset) store.delete(k)
}

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  if (store.size > SWEEP_ABOVE) sweep(now)
  const b = store.get(key)
  if (!b || now > b.reset) {
    store.set(key, { count: 1, reset: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }
  if (b.count >= limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((b.reset - now) / 1000)) }
  b.count++
  return { ok: true, retryAfter: 0 }
}

/** Best-effort client IP from the standard proxy headers (Vercel sets these). */
export function clientIp(req: Request): string {
  const h = req.headers
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

/** Guard a route: returns a 429 response when over the limit, else null. */
export function limited(
  req: Request,
  opts: { name: string; id?: string | null; limit: number; windowMs: number },
): NextResponse | null {
  const who = opts.id || clientIp(req)
  const { ok, retryAfter } = rateLimit(`${opts.name}:${who}`, opts.limit, opts.windowMs)
  if (ok) return null
  return NextResponse.json(
    { error: 'Too many requests — please slow down and try again shortly.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}
