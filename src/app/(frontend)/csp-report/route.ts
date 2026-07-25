import { NextResponse, type NextRequest } from 'next/server'

/**
 * Sink for CSP violation reports (both the legacy `report-uri` body and the
 * newer `report-to`/Reporting-API batch). Logs a concise line per distinct
 * violation so a mis-sourced directive surfaces in the server logs instead of
 * silently breaking something in production.
 *
 * Best-effort in-memory de-dupe keeps a report storm (one bad directive fires on
 * every page) from flooding the logs — per instance, which is fine for signal.
 */
export const dynamic = 'force-dynamic'

const seen = new Map<string, number>()
const DEDUPE_MS = 5 * 60_000

function noteOnce(key: string): boolean {
  const now = Date.now()
  const last = seen.get(key)
  if (last && now - last < DEDUPE_MS) return false
  seen.set(key, now)
  // Bound the map so it can't grow without limit.
  if (seen.size > 200) for (const k of seen.keys()) { seen.delete(k); if (seen.size <= 150) break }
  return true
}

type Violation = { directive?: string; blocked?: string; docUri?: string }

function extract(body: unknown): Violation[] {
  if (!body || typeof body !== 'object') return []
  // Legacy report-uri: { "csp-report": {...} }
  const legacy = (body as { 'csp-report'?: Record<string, unknown> })['csp-report']
  if (legacy) {
    return [
      {
        directive: String(legacy['effective-directive'] ?? legacy['violated-directive'] ?? ''),
        blocked: String(legacy['blocked-uri'] ?? ''),
        docUri: String(legacy['document-uri'] ?? ''),
      },
    ]
  }
  // Reporting-API: an array of { type, body: {...} }
  if (Array.isArray(body)) {
    return body
      .filter((r) => (r as { type?: string })?.type === 'csp-violation')
      .map((r) => {
        const b = (r as { body?: Record<string, unknown> }).body ?? {}
        return {
          directive: String(b.effectiveDirective ?? b.violatedDirective ?? ''),
          blocked: String(b.blockedURL ?? b.blockedURI ?? ''),
          docUri: String(b.documentURL ?? ''),
        }
      })
  }
  return []
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  for (const v of extract(body)) {
    if (!v.directive && !v.blocked) continue
    if (noteOnce(`${v.directive}|${v.blocked}`)) {
      console.warn(`[csp] blocked ${v.directive || 'unknown'} → ${v.blocked || 'inline'} on ${v.docUri || '?'}`)
    }
  }
  return new NextResponse(null, { status: 204 })
}
