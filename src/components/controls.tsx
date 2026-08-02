'use client'

import { useEffect, useState, type ReactNode } from 'react'

/**
 * House-style form controls. Native selects and number inputs are the last
 * default-looking things on the site; these replace them in the kitchen-pass
 * language — mono type, hairline borders, flame focus, hard edges. Theme-aware
 * (tokens only, no hex).
 */

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23888' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")"

export function Select({
  value,
  onChange,
  children,
  ariaLabel,
  className = '',
}: {
  value: string | number
  onChange: (value: string) => void
  children: ReactNode
  ariaLabel?: string
  className?: string
}) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full cursor-pointer appearance-none rounded border border-rule bg-transparent py-2 pr-9 pl-3 font-mono text-eyebrow text-ink focus:border-flame focus:outline-none ${className}`}
      style={{
        backgroundImage: CHEVRON,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.75rem center',
        backgroundSize: '10px 6px',
      }}
    >
      {children}
    </select>
  )
}

/** Minutes → "45 min" / "1h 30m" so nobody converts hours in their head. */
function formatDuration(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  suffix,
  duration = false,
  ariaLabel,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  /** Store minutes, but show "1h 30m" when unfocused and over an hour. */
  duration?: boolean
  ariaLabel?: string
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  const display = (m: number) => (duration ? formatDuration(m) : String(m))
  const btn =
    'grid h-9 w-9 shrink-0 cursor-pointer place-items-center border-none bg-transparent font-mono text-lg text-ink transition-colors hover:bg-wash disabled:cursor-default disabled:text-rule'

  // Local buffer so a user can type "90" freely without each keystroke being
  // clamped or reformatted mid-entry. Focused → raw minutes (editable);
  // blurred → the friendly display. Parent value updates only on commit.
  const [focused, setFocused] = useState(false)
  const [buffer, setBuffer] = useState(display(value))
  useEffect(() => setBuffer(focused ? String(value) : display(value)), [value, focused])

  const commit = () => {
    const parsed = Number.parseInt(buffer, 10)
    const next = Number.isNaN(parsed) ? value : clamp(parsed)
    if (next !== value) onChange(next)
    else setBuffer(display(next))
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex items-center justify-between rounded border border-rule focus-within:border-flame"
    >
      <button
        type="button"
        aria-label="Decrease"
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        className={`${btn} rounded-l`}
      >
        −
      </button>
      <span className="inline-flex items-baseline">
        <input
          type="text"
          inputMode="numeric"
          aria-label={ariaLabel}
          value={buffer}
          onChange={(e) => setBuffer(e.target.value.replace(/[^0-9]/g, ''))}
          onFocus={(e) => {
            setFocused(true)
            const el = e.currentTarget
            requestAnimationFrame(() => el.select())
          }}
          onBlur={() => {
            setFocused(false)
            commit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
              e.currentTarget.blur()
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              onChange(clamp(value + step))
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              onChange(clamp(value - step))
            }
          }}
          className={`bg-transparent text-center font-mono text-note font-semibold tabular-nums text-ink focus:outline-none ${duration ? 'w-[4.5rem]' : 'w-10'}`}
        />
        {suffix && !duration ? (
          <span className="-ml-0.5 text-caption font-normal text-slate">{suffix}</span>
        ) : null}
      </span>
      <button
        type="button"
        aria-label="Increase"
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        className={`${btn} rounded-r`}
      >
        +
      </button>
    </div>
  )
}
