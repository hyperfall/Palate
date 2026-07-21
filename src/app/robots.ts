import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/lib/site'

/**
 * Lives at the app root, NOT inside the `(frontend)` route group.
 *
 * This app has two root layouts — `(frontend)` and Payload's `(payload)` — and
 * with that arrangement a `robots.ts` inside a group silently serves a 404
 * rather than failing loudly. `sitemap.ts` happens to resolve from either
 * place, which makes the asymmetry easy to miss. Keep both here.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // None of these are content. /brand-slot returns per-visitor partner
        // JSON, and the admin and API paths only ever 401 — crawling any of
        // them is wasted budget.
        disallow: ['/admin', '/api/', '/brand-slot'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
