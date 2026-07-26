import { useId } from 'react'

import { SOCIAL_PLATFORMS, type SocialKey, type Socials } from '@/lib/socials'

/**
 * Brand tints for the `brand` variant. Instagram is drawn with its signature
 * gradient (see ICONS below); X and TikTok are monochrome marks, so they use
 * `--color-ink` and adapt to light/dark. The rest carry their house colour.
 */
const BRAND: Record<SocialKey, string> = {
  instagram: 'var(--color-ink)', // overridden by the gradient icon
  tiktok: 'var(--color-ink)',
  youtube: '#ff0033',
  x: 'var(--color-ink)',
  website: 'var(--color-flame)',
}

/** Simple, recognizable glyphs for the curated platform set. */
const ICONS: Record<SocialKey, React.ReactNode> = {
  instagram: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M16.5 3c.3 2.1 1.6 3.6 3.5 3.9v2.6c-1.3.1-2.5-.3-3.6-1v5.9a5.9 5.9 0 1 1-5.9-5.9c.3 0 .6 0 .9.1v2.7a3.2 3.2 0 1 0 2.3 3V3h2.8z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M22 8.2a2.6 2.6 0 0 0-1.8-1.8C18.6 6 12 6 12 6s-6.6 0-8.2.4A2.6 2.6 0 0 0 2 8.2 27 27 0 0 0 1.7 12 27 27 0 0 0 2 15.8a2.6 2.6 0 0 0 1.8 1.8C5.4 18 12 18 12 18s6.6 0 8.2-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22.3 12 27 27 0 0 0 22 8.2zM10 15V9l5.2 3z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M18.2 2h3.3l-7.2 8.3L23 22h-6.6l-5.2-6.8L5.3 22H2l7.7-8.8L1.6 2h6.8l4.7 6.2zm-1.2 18h1.8L7.1 3.9H5.2z" />
    </svg>
  ),
  website: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </svg>
  ),
}

/** Instagram in its signature gradient — the `brand` variant swaps it in.
 *  The gradient id must be unique per mount: two hovercards overlapping during
 *  the close delay would otherwise put duplicate ids in the DOM. */
function InstagramBrand() {
  const gid = `ig-grad-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" strokeWidth="1.9" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#feda75" />
          <stop offset="0.35" stopColor="#fa7e1e" />
          <stop offset="0.65" stopColor="#d62976" />
          <stop offset="1" stopColor="#962fbf" />
        </linearGradient>
      </defs>
      <g stroke={`url(#${gid})`}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
      </g>
      <circle cx="17.5" cy="6.5" r="1.1" fill={`url(#${gid})`} />
    </svg>
  )
}

/**
 * A row of social-link icons; renders nothing when there are none.
 * `variant="brand"` tints each mark with its house colour (Instagram gets its
 * gradient); the default is a muted slate that warms to flame on hover.
 */
export function SocialLinks({
  socials,
  className = '',
  variant = 'muted',
}: {
  socials: Socials | null | undefined
  className?: string
  variant?: 'muted' | 'brand'
}) {
  if (!socials) return null
  const present = SOCIAL_PLATFORMS.filter((p) => socials[p.key])
  if (present.length === 0) return null
  const brand = variant === 'brand'

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {present.map((p) => (
        <a
          key={p.key}
          href={socials[p.key]}
          target="_blank"
          rel="me nofollow noopener"
          aria-label={p.label}
          title={p.label}
          style={brand ? { color: BRAND[p.key] } : undefined}
          className={
            brand
              ? 'opacity-90 transition-all hover:-translate-y-0.5 hover:opacity-100'
              : 'text-slate transition-colors hover:text-flame'
          }
        >
          {brand && p.key === 'instagram' ? <InstagramBrand /> : ICONS[p.key]}
        </a>
      ))}
    </div>
  )
}
