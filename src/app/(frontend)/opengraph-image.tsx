import { ImageResponse } from 'next/og'

import { SITE } from '@/lib/site'

/**
 * The share card every page falls back to.
 *
 * Until now only recipe pages set an og:image, so a link to anything else —
 * the catalogue, a cuisine, the planner, the home page — posted as a bare grey
 * rectangle with a URL under it. That is the first thing anyone sees of the
 * site, and it was blank on every page a person is most likely to share.
 *
 * This file convention covers the whole route tree at once: nested segments
 * inherit it, and a page that sets openGraph.images itself still wins, so the
 * recipe pages keep their own photographs. One file, no per-page edits, no
 * asset to keep in sync with the palette.
 *
 * It draws in the site's own colours rather than a typeface — Satori only
 * renders fonts it is handed the bytes for, and the display face is served by
 * next/font at build time rather than living in the repo. Vendoring it is a
 * deliberate choice (a committed file and its licence), so until that is asked
 * for, the composition and the flame carry the brand and the type stays quiet.
 */

export const alt = `${SITE.name} — ${SITE.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Straight from theme.css. The card is always the dark "pan" surface: a share
// card has no theme to follow, and the pan is the one that reads as the site.
const PAN = '#14100c'
const PAN_LINE = '#2c2219'
const MILK = '#ece6da'
const FLAME = '#f2683c'
const SLATE = '#ab9f8f'

// The tagline is two sentences and reads as a turn: the promise, then the
// aside. Splitting on the first full stop keeps SITE.tagline the only place it
// is written, so changing it there restyles the card rather than desyncing it.
const [promise, aside] = (() => {
  const at = SITE.tagline.indexOf('. ')
  if (at === -1) return [SITE.tagline, '']
  return [SITE.tagline.slice(0, at + 1), SITE.tagline.slice(at + 2)]
})()

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: PAN,
          padding: '72px 80px',
        }}
      >
        {/* The pass rail, the same fixture that tops every page. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 20, height: 20, borderRadius: 20, background: FLAME }} />
          <div
            style={{
              fontSize: 34,
              letterSpacing: 12,
              color: MILK,
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            {SITE.name}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 72,
              lineHeight: 1.1,
              color: MILK,
              maxWidth: 1040,
              letterSpacing: -1.5,
              fontWeight: 600,
            }}
          >
            {promise}
          </div>
          <div
            style={{
              fontSize: 72,
              lineHeight: 1.1,
              color: FLAME,
              maxWidth: 1040,
              letterSpacing: -1.5,
              fontWeight: 600,
            }}
          >
            {aside}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ width: '100%', height: 2, background: PAN_LINE }} />
          <div style={{ fontSize: 27, color: SLATE, maxWidth: 900, lineHeight: 1.35 }}>
            {SITE.description}
          </div>
        </div>
      </div>
    ),
    size,
  )
}
