import type { ReactNode } from 'react'

import { PROVENANCE_BADGES, type Provenance } from '@/lib/taxonomy'

/**
 * §3: provenance "drives trust signals, editorial badges, filtering, and Google
 * transparency". Showing it is the visible half of that promise — a reader can
 * always tell whether a human cooked this or a machine imported it.
 *
 * Built as a two-part seal: a filled mark plate joined to a tinted label. The
 * first version was one outlined span set at -rotate-1 to suggest a rubber
 * stamp, and read as neither — a badge should look deliberate, and a single
 * tilted element on an otherwise square page reads as a mistake rather than a
 * flourish. A stamp earns the word through structure — a mark, a plate, a seam
 * — not by sitting crooked.
 */

const MARKS: Record<Provenance, { icon: ReactNode; plate: string; label: string }> = {
  authored: {
    // A tick inside a ring: checked, by someone.
    icon: (
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M5 8.2l2.1 2.1L11 6.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    plate: 'bg-flame text-paper',
    label: 'border-flame/50 bg-flame/10 text-flame-text',
  },
  community: {
    // Two figures: sent in by a person, read by another.
    icon: (
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
        <circle cx="6" cy="5.5" r="2.4" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M1.8 13c.4-2.3 2.1-3.6 4.2-3.6s3.8 1.3 4.2 3.6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M11 4.2a2.2 2.2 0 010 4.3M12.4 12.9c-.2-1.3-.7-2.3-1.5-3"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
    plate: 'bg-ink text-paper',
    label: 'border-ink/25 bg-wash text-ink',
  },
  'api-imported': {
    // An inbound arrow: it came from elsewhere. The quietest of the three,
    // because it carries the least assurance.
    icon: (
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
        <path
          d="M8 2.5v7.5M8 10l-2.8-2.8M8 10l2.8-2.8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M2.8 12.5h10.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    plate: 'bg-slate text-paper',
    label: 'border-rule text-slate',
  },
}

export function ProvenanceBadge({
  provenance,
  attribution,
}: {
  provenance: Provenance
  attribution?: { sourceName?: string | null; sourceUrl?: string | null } | null
}) {
  const badge = PROVENANCE_BADGES[provenance]
  const mark = MARKS[provenance]
  if (!badge || !mark) return null

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <span
        // One rounded shell with a seam down the middle: the plate carries the
        // colour and the mark, the label carries the words. Square to the page.
        className={`inline-flex w-fit items-stretch overflow-hidden rounded border ${mark.label}`}
      >
        <span className={`grid shrink-0 place-items-center px-1.5 ${mark.plate}`}>{mark.icon}</span>
        <span className="px-2 py-1 font-mono text-caption font-semibold tracking-[0.1em] uppercase">
          {badge.label}
        </span>
      </span>
      <span className="max-w-[38ch] text-detail leading-snug text-slate">
        {badge.blurb}
        {provenance === 'api-imported' && attribution?.sourceName && (
          <>
            {' '}
            Source:{' '}
            {attribution.sourceUrl ? (
              <a href={attribution.sourceUrl} rel="nofollow noopener" target="_blank">
                {attribution.sourceName}
              </a>
            ) : (
              attribution.sourceName
            )}
            .
          </>
        )}
      </span>
    </div>
  )
}
