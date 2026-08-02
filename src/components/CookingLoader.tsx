/**
 * The site's cooking loader — a simmering pot with rising steam over a
 * flickering flame. Palette-only (ink pot, flame fire, slate steam), so it
 * works in both themes; motion-safe via the CSS. Use inline (with a label)
 * wherever the old text-only "Checking the board…" states lived, or full-page
 * as a centred block.
 */
export function CookingLoader({
  label,
  size = 44,
  center = false,
}: {
  label?: string
  size?: number
  center?: boolean
}) {
  const pot = (
    <span role="status" aria-label={label ?? 'Loading'} className="inline-flex flex-col items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        {/* Steam */}
        <g stroke="var(--color-slate)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7">
          <path className="cook-steam" d="M18 15 q-2.5 -3 0 -6 q2.5 -3 0 -6" />
          <path className="cook-steam cook-steam-2" d="M24 15 q-2.5 -3 0 -6 q2.5 -3 0 -6" />
          <path className="cook-steam cook-steam-3" d="M30 15 q-2.5 -3 0 -6 q2.5 -3 0 -6" />
        </g>
        {/* Pot body */}
        <path
          d="M9 20 h30 v9 a8 8 0 0 1 -8 8 h-14 a8 8 0 0 1 -8 -8 z"
          fill="var(--color-card)"
          stroke="var(--color-ink)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Handles */}
        <path d="M9 24 h-4 M39 24 h4" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
        {/* Rim */}
        <path d="M7 20 h34" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
        {/* Flame */}
        <path
          className="cook-flame"
          d="M24 46 c-4 -1 -6 -4 -4 -7 c0.4 2 1.6 2.4 2 2 c-1 -3 1 -5 2 -6 c0 2 1.6 2.8 2.4 4 c1.2 1.8 0.8 6.2 -2.4 7 z"
          fill="var(--color-flame)"
        />
      </svg>
      {label && (
        <span className="font-mono text-detail tracking-[0.08em] text-slate uppercase">
          {label}
        </span>
      )}
    </span>
  )

  if (center) {
    return <div className="grid min-h-[40vh] w-full place-items-center">{pot}</div>
  }
  return pot
}
