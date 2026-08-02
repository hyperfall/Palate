/**
 * Read-only star display. Renders a 0–5 value with fractional fill (4.3 → four
 * stars and a third), plus an optional vote count. Purely presentational — the
 * caller decides whether to render it at all (we don't show empty ratings, so
 * cards omit this entirely until a recipe has a score).
 */
export function StarRating({
  value,
  count,
  size = 'md',
  className = '',
}: {
  value: number
  /** Community vote count. Omit for an editorial-only score (no count shown). */
  count?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  const px = size === 'sm' ? '0.8125rem' : size === 'lg' ? '1.25rem' : '1rem'

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        role="img"
        aria-label={`Rated ${value.toFixed(1)} out of 5${count ? ` from ${count} rating${count === 1 ? '' : 's'}` : ''}`}
        className="relative inline-block leading-none select-none"
        style={{ fontSize: px }}
      >
        {/* Empty track, then a clipped gold overlay to the fill percentage. */}
        <span className="text-rule" aria-hidden="true">★★★★★</span>
        <span
          aria-hidden="true"
          className="absolute inset-0 overflow-hidden whitespace-nowrap text-flame"
          style={{ width: `${pct}%` }}
        >
          ★★★★★
        </span>
      </span>
      {count !== undefined && count > 0 && (
        <span className="font-mono text-caption tabular-nums text-slate">
          {value.toFixed(1)} <span className="text-slate/70">({count})</span>
        </span>
      )}
    </span>
  )
}
