import { notFound } from 'next/navigation'

/**
 * Catch-all that funnels any URL matching no real route into the (frontend)
 * tree, so the styled `(frontend)/not-found.tsx` renders it under a proper root
 * layout. This replaces the old root `app/not-found.tsx`, which was orphaned
 * (no root layout — Turbopack tolerated it, webpack rejects it, and adding a
 * root layout would collide with Payload's admin layout).
 *
 * Route priority keeps this safe: every real page and the (payload) `admin`/
 * `api` segments are more specific than a root catch-all, so they always win —
 * only genuinely unmatched paths reach here.
 */
export default function NotFoundCatchAll() {
  notFound()
}
