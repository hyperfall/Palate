import { PROVENANCE_BADGES, type Provenance } from '@/lib/taxonomy'

/**
 * §3: provenance "drives trust signals, editorial badges, filtering, and Google
 * transparency". Showing it is the visible half of that promise — a reader can
 * always tell whether a human cooked this or a machine imported it.
 */
export function ProvenanceBadge({
  provenance,
  attribution,
}: {
  provenance: Provenance
  attribution?: { sourceName?: string | null; sourceUrl?: string | null } | null
}) {
  const badge = PROVENANCE_BADGES[provenance]
  if (!badge) return null

  // Authored recipes get the confident flame stamp; imported ones a quieter
  // ink outline — the trust hierarchy is visible at a glance (§3).
  const stamped = provenance === 'authored'

  return (
    <div className="inline-flex flex-col gap-1.5">
      <span
        className={`inline-flex w-fit -rotate-1 items-center gap-1.5 border-2 px-2.5 py-1 font-mono text-[0.8125rem] font-bold tracking-[0.12em] uppercase ${
          stamped ? 'border-flame text-flame' : 'border-ink/60 text-ink/70'
        }`}
        style={{ borderRadius: '2px' }}
      >
        <span aria-hidden="true" className="text-[0.9em]">{stamped ? '✓' : '⌁'}</span>
        {badge.label}
      </span>
      <span className="max-w-[38ch] text-[0.8125rem] leading-snug text-slate">
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
