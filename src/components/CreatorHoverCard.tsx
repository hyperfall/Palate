import Link from 'next/link'

import { SocialLinks } from '@/components/SocialIcons'
import type { Socials } from '@/lib/socials'

export type CreatorCard = {
  name: string
  handle: string
  verified: boolean
  avatarUrl: string | null
  bio: string | null
  socials: Socials
}

/** The mini profile shown by the hover/tap byline. Presentational only. */
export function CreatorHoverCard({ card, loading }: { card: CreatorCard | null; loading: boolean }) {
  return (
    <div className="w-64 overflow-hidden rounded-xl border border-ink/10 bg-card shadow-block">
      {/* A single hairline of brand colour — identity without a wall of orange. */}
      <div className="h-0.5 bg-flame" aria-hidden="true" />

      {loading || !card ? (
        <div className="flex items-center gap-3 p-4">
          <span className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-wash" />
          <span className="h-4 w-28 animate-pulse rounded bg-wash" />
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-wash font-display text-lg text-ink ring-1 ring-ink/10">
              {card.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- small avatar
                <img src={card.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                card.name[0]?.toUpperCase()
              )}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate font-display text-[1.0625rem] text-ink">{card.name}</span>
                {card.verified && (
                  <span title="Verified creator" className="text-flame" aria-label="Verified creator">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                      <path d="M12 2l2.4 1.8 3-.3 1 2.8 2.6 1.4-.9 2.9.9 2.9-2.6 1.4-1 2.8-3-.3L12 22l-2.4-1.8-3 .3-1-2.8L3 16.4l.9-2.9L3 10.6l2.6-1.4 1-2.8 3 .3z" />
                      <path d="M9 12l2 2 4-4" fill="none" stroke="var(--color-card)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </span>
              <span className="block truncate font-mono text-[0.75rem] text-slate">@{card.handle}</span>
            </span>
          </div>

          {card.bio && <p className="mt-3 text-[0.875rem] leading-snug text-ink/70">{card.bio}</p>}

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-rule pt-3">
            <SocialLinks socials={card.socials} variant="brand" />
            <Link
              href={`/creator/${card.handle}`}
              className="group/vp inline-flex shrink-0 items-center gap-1 font-mono text-[0.6875rem] tracking-[0.1em] text-slate uppercase transition-colors hover:text-flame"
            >
              Profile
              <span aria-hidden="true" className="transition-transform group-hover/vp:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
